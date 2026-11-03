import React, { useState } from 'react';
import { Check, Mic, MicOff, Square } from 'lucide-react';
import { api, ImportResult } from '../../services/api';
import { PERSON_FIELDS, PersonField, PersonKind, PersonValues, parseSpokenPerson, spokenDigits } from '../../utils/peopleImport';
import { SpeechLanguage, useSpeech } from '../../utils/useSpeech';
import { useLanguage } from '../../context/LanguageContext';
import { BigButton } from '../common/ui';
import { inputClass } from '../configuration/ConfigShared';
import { usePersonFieldLabel } from './personLabels';

const WHOLE = 'whole';

/** Add one person by typing or by voice, in English or Tamil. The office checks the fields before saving. */
export const PersonEntry: React.FC<{
  kind: PersonKind;
  areaNames: string[];
  onAdded: () => void;
}> = ({ kind, areaNames, onAdded }) => {
  const { t, language } = useLanguage();
  const label = usePersonFieldLabel();
  const speech = useSpeech();
  const [spokenLanguage, setSpokenLanguage] = useState<SpeechLanguage>(language === 'ta' ? 'ta-IN' : 'en-IN');
  const [values, setValues] = useState<PersonValues>({});
  const [heard, setHeard] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (field: PersonField, value: string) => setValues(prev => ({ ...prev, [field]: value }));

  const speakField = (field: PersonField) =>
    speech.listen(field, spokenLanguage, text => {
      const numeric = field === 'mobile' || field === 'alternate';
      setValues(prev => ({
        ...prev,
        [field]: numeric ? spokenDigits(text) || text : prev[field] ? `${prev[field]} ${text}` : text,
      }));
    });

  const speakAll = () =>
    speech.listen(WHOLE, spokenLanguage, text => {
      setHeard(text);
      setValues(prev => ({ ...prev, ...parseSpokenPerson(text, kind) }));
    });

  const save = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result: ImportResult = await api.importPeople(kind, [values]);
      if (result.created > 0) {
        setNotice({ ok: true, text: `${values.name}: ${t('added', 'added')}` });
        setValues({});
        setHeard('');
        onAdded();
      } else {
        setNotice({ ok: false, text: result.skipped[0]?.reason || t('somethingWentWrong', 'Something went wrong. Please try again.') });
      }
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : t('somethingWentWrong', 'Something went wrong. Please try again.') });
    } finally {
      setBusy(false);
    }
  };

  const problemText =
    speech.problem === 'blocked'
      ? t('micBlocked', 'The microphone is blocked. Allow it in the browser. It works only on a secure (https) address or on this computer.')
      : speech.problem === 'no-speech'
      ? t('micNoSpeech', 'Nothing was heard. Please try again.')
      : speech.problem === 'failed'
      ? t('micFailed', 'Voice typing did not work. Check the internet connection, or type instead.')
      : null;

  return (
    <div className="space-y-3">
      {speech.supported ? (
        <div className="space-y-2">
          <div className="flex p-1 rounded-2xl bg-navy-950 border border-slate-800 w-fit" role="group" aria-label={t('speakIn', 'Speak in')}>
            {([['en-IN', 'English'], ['ta-IN', 'தமிழ்']] as [SpeechLanguage, string][]).map(([value, name]) => (
              <button
                key={value}
                type="button"
                aria-pressed={spokenLanguage === value}
                onClick={() => setSpokenLanguage(value)}
                className={`px-4 py-1.5 rounded-xl text-sm font-bold ${spokenLanguage === value ? 'bg-gold-500 text-navy-950' : 'text-slate-300'}`}
              >
                {name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={speakAll}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold border ${
              speech.listeningTo === WHOLE ? 'bg-rose-600 border-rose-500 text-white' : 'bg-navy-950 border-gold-500/40 text-gold-300'
            }`}
          >
            {speech.listeningTo === WHOLE ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {speech.listeningTo === WHOLE ? t('listening', 'Listening... tap to stop') : t('speakAllDetails', 'Speak all details')}
          </button>
          <p className="text-xs text-slate-400">
            {kind === 'customer'
              ? t('speakExampleCustomer', 'Say, for example: name Ravi, mobile 98765 43210, shop Ravi Stores, area Bazaar.')
              : t('speakExampleCollector', 'Say, for example: name Ravi, mobile 98765 43210, area Bazaar.')}
          </p>
          {heard && <p className="text-xs text-slate-300">{t('heard', 'Heard')}: {heard}</p>}
          {problemText && <p className="text-sm text-rose-300">{problemText}</p>}
        </div>
      ) : (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <MicOff className="w-4 h-4" />
          {t('voiceNotSupported', 'Voice typing needs Chrome, Edge or Safari. You can still type.')}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PERSON_FIELDS[kind].map(field => (
          <div key={field}>
            <label htmlFor={`${kind}-${field}`} className="block text-sm font-bold text-slate-300 mb-1.5">
              {label(field)}{field === 'name' || field === 'mobile' ? ' *' : ''}
            </label>
            <div className="flex items-center gap-2">
              <input
                id={`${kind}-${field}`}
                className={inputClass}
                value={values[field] ?? ''}
                inputMode={field === 'mobile' || field === 'alternate' ? 'tel' : undefined}
                list={field === 'area' ? `${kind}-areas` : undefined}
                onChange={e => set(field, e.target.value)}
              />
              {speech.supported && field !== 'email' && (
                <button
                  type="button"
                  onClick={() => speakField(field)}
                  aria-label={`${t('speak', 'Speak')}: ${label(field)}`}
                  className={`flex-shrink-0 p-3 rounded-xl border ${
                    speech.listeningTo === field ? 'bg-rose-600 border-rose-500 text-white' : 'bg-navy-950 border-slate-700 text-gold-300'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}
        <datalist id={`${kind}-areas`}>
          {areaNames.map(name => <option key={name} value={name} />)}
        </datalist>
      </div>

      {notice && (
        <div className={`px-4 py-3 rounded-2xl text-sm font-semibold border ${
          notice.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {notice.text}
        </div>
      )}

      <BigButton tone="gold" icon={Check} label={busy ? t('saving', 'Saving...') : t('add', 'Add')} onClick={save} disabled={busy || !values.name?.trim() || !values.mobile?.trim()} />
    </div>
  );
};
