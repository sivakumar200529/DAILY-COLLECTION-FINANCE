import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PageTitle, PillTabs } from '../common/ui';
import { NotebookCardSheet } from './NotebookCardSheet';
import { NotebookGrid } from './NotebookGrid';

type Tab = 'card' | 'running';

/**
 * Entering the paper notebooks. "New card": the card's terms make a sheet, one customer per row,
 * whose loans and past payments are added together. "Running loans": the loans already in the app,
 * day by day, to carry on or correct. Both can take the whole screen.
 */
export const NotebookEntryView: React.FC<{ officeName: string }> = ({ officeName }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('card');
  const [full, setFull] = useState(false);
  // The sheets live in one element that moves between the page and the window's body (the page's
  // layout keeps a fixed frame from covering the window). Moving it keeps everything typed.
  const [host] = useState(() => document.createElement('div'));
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    (full ? document.body : slot.current)?.appendChild(host);
  }, [full, host]);
  useEffect(() => () => host.remove(), [host]);

  // Full screen: the sheet takes the whole window (and the browser's full screen where allowed); Esc leaves.
  useEffect(() => {
    if (!full) return;
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    const onExit = () => { if (!document.fullscreenElement) setFull(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onExit);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onExit);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, [full]);

  const fullButton = (
    <button
      type="button"
      onClick={() => setFull(!full)}
      className="px-3 py-2 rounded-xl bg-navy-900 border border-slate-700 text-slate-200 text-sm font-bold flex items-center gap-1.5 whitespace-nowrap hover:border-gold-500/60"
    >
      {full ? <Minimize2 className="w-4 h-4 text-gold-400" /> : <Maximize2 className="w-4 h-4 text-gold-400" />}
      {full ? t('backToPage', 'Back to page') : t('fullScreen', 'Full screen')}
    </button>
  );

  const tabs = (
    <PillTabs<Tab>
      tabs={[
        { id: 'card', label: t('notebookNewCard', 'New card') },
        { id: 'running', label: t('notebookRunningLoans', 'Running loans') },
      ]}
      value={tab}
      onChange={setTab}
    />
  );

  // Both stay mounted, so typed amounts survive switching tabs.
  const body = (
    <>
      <div className={tab === 'card' ? `flex flex-col ${full ? 'flex-1 min-h-0 gap-2' : 'gap-4'}` : 'hidden'}>
        <NotebookCardSheet full={full} />
      </div>
      <div className={tab === 'running' ? `flex flex-col ${full ? 'flex-1 min-h-0 gap-2' : 'gap-4'}` : 'hidden'}>
        <NotebookGrid officeName={officeName} full={full} active={tab === 'running'} />
      </div>
    </>
  );

  // One tree in both modes: full screen only changes the frame, so nothing typed is lost on the way.
  return <div ref={slot}>{createPortal(
    <div
      className={full ? 'fixed inset-0 z-[70] bg-navy-950 flex flex-col gap-2 p-2 sm:p-3 font-sans' : 'space-y-4'}
      role={full ? 'dialog' : undefined}
      aria-label={full ? t('notebookEntry', 'Notebook entry') : undefined}
    >
      {full ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-black text-gold-300 shrink-0">{t('notebookEntry', 'Notebook entry')}</h2>
            {tabs}
          </div>
          {fullButton}
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <PageTitle
                title={t('notebookEntry', 'Notebook entry')}
                subtitle={tab === 'card'
                  ? t('notebookCardHint', 'Fill in the card first: start date, total loan, payment per day and end date. The sheet then has a column for each day; type one customer per row and their amount on each day ("=" repeats the day before). Saving adds the customers, their loans and payments.')
                  : t('notebookEntryHint', 'Type each day\'s amount as in the collection notebook. "=" copies the day before; a block copied from Excel can be pasted; clear a cell to remove that day\'s payment.')}
              />
            </div>
            <div className="shrink-0">{fullButton}</div>
          </div>
          {tabs}
        </>
      )}
      {body}
    </div>,
    host
  )}</div>;
};
