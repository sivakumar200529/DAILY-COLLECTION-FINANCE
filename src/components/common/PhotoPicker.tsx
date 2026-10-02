import React, { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

/** Shrinks a photo to at most `maxSide` pixels and re-encodes it as JPEG (phone photos are several MB). */
export async function shrinkPhoto(file: File, maxSide = 1000, quality = 0.8): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not read the photo'));
      image.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uploads a picked photo and returns its URL. */
export async function uploadPickedPhoto(file: File): Promise<string> {
  const { url } = await api.uploadPhoto(await shrinkPhoto(file));
  return url;
}

interface PhotoPickerProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
}

/** A photo slot: shows the photo, or a big "Take photo" button (camera on phones, file on computers). */
export const PhotoPicker: React.FC<PhotoPickerProps> = ({ label, value, onChange }) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadPickedPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <span className="block text-sm font-bold text-slate-300 mb-1.5">{label}</span>
      {value ? (
        <div className="relative w-full max-w-[220px]">
          <img src={value} alt={label} className="w-full h-36 object-cover rounded-2xl border border-slate-700" />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={t('remove', 'Remove')}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-navy-950/90 text-slate-200 hover:text-rose-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full max-w-[220px] h-24 rounded-2xl border-2 border-dashed border-slate-700 text-slate-300 hover:border-gold-500/60 flex flex-col items-center justify-center gap-1 text-sm font-bold disabled:opacity-50"
        >
          <Camera className="w-6 h-6 text-gold-400" />
          {busy ? t('uploading', 'Saving photo...') : t('takePhoto', 'Take photo')}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => pick(e.target.files?.[0])}
      />
      {error && <p className="text-sm text-rose-300 mt-1">{error}</p>}
    </div>
  );
};
