import { useState } from 'react';
import type { Game } from '../models/Game';
import { useAuth } from '../context/AuthContext';
import { useGamesData } from '../context/DataCacheContext';
import { useMyGameIds } from '../hooks/useGameScope';
import { useMediaQuery } from '../hooks/use-media-query';
import { createBggGame, getGames, setGameHeart, submitImage, PENDING_IMAGES_CHANGED } from '../services/databaseService';
import { loadBggGames } from '../services/bggService';
import { importBggGames } from '../lib/importBggGames';
import { gameFromBgg, type BggResult } from '../lib/bgg';
import { isAdminEmail } from '../lib/admin';
import { cn } from '../lib/utils';
import { AddGameForm } from './AddGameForm';
import { GameDiscovery, type GameDiscoveryLayout } from './GameDiscovery';
import { BackIcon, CloseIcon } from './icons';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from './ui/drawer';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (game: Omit<Game, 'id'>) => Promise<void>;
  initialQuery?: string;
}

export function AddGamesDialog(props: Props) {
  // Closing cancels reads and resets the preview, selections and manual form.
  return props.open ? <AddGamesContent {...props} /> : null;
}

function AddGamesContent({ onOpenChange, onSubmit, initialQuery = '' }: Props) {
  const { user, player, refreshPlayer } = useAuth();
  const { games, refreshGames } = useGamesData();
  const { ids: myIds } = useMyGameIds(games);
  const desktop = useMediaQuery('(min-width: 768px)');
  const [mode, setMode] = useState<'search' | 'collection' | 'manual'>('search');
  const [saving, setSaving] = useState(false);
  const admin = isAdminEmail(user?.email);
  const visible = games.filter((game) => !game.pending || admin || game.createdByID === user?.uid || myIds.has(game.id));

  const addExisting = async (game: Game) => {
    if (!player) throw new Error('Sign in and finish your profile to add games.');
    await setGameHeart(player.id, game.id, true);
    await refreshPlayer();
  };
  const importGames = async (selected: BggResult[], onStatus: (message: string) => void) => {
    if (!user || !player) throw new Error('Sign in and finish your profile to import games.');
    // Fresh data prevents duplicates if the catalogue changed since opening.
    const catalogue = await getGames({ fresh: true });
    const result = await importBggGames(selected, {
      uid: user.uid, games: catalogue,
      loadDetails: (ids) => loadBggGames(ids, { onStatus }),
      saveGame: async (game) => {
        const { coverArt: _coverArt, ...fields } = game;
        return createBggGame(admin ? game : { ...fields, pending: true });
      },
      saveCover: async (game, detail) => {
        const cover = gameFromBgg(detail, user.uid).coverArt;
        if (cover) await submitImage('game', game.id, cover, user.uid, {}, { notify: false });
      },
      heartGame: (id) => setGameHeart(player.id, id, true),
      onProgress: (done, total) => onStatus(`Adding games… ${done} of ${total}`),
    });
    // Refresh the review queue once, even when hundreds of covers were imported.
    window.dispatchEvent(new Event(PENDING_IMAGES_CHANGED));
    // A refresh failure must not turn successful writes into a failed import.
    await Promise.allSettled([refreshGames(), refreshPlayer()]);
    return result;
  };

  if (mode === 'manual') return <AddGameForm open onOpenChange={onOpenChange} onSubmit={onSubmit} />;

  return <GameDiscovery key={mode} mode={mode} initialQuery={initialQuery} games={visible} myIds={myIds}
    onImport={importGames} onAddExisting={addExisting} onSavingChange={setSaving}
    renderLayout={(layout) => <GameDiscoveryDialog {...layout} desktop={desktop} saving={saving} onOpenChange={onOpenChange} />}
    entryHeader={<div className="grid grid-cols-2 rounded-full bg-muted p-1" role="group" aria-label="How to add games">
      {([
        ['search', 'Search games'],
        ['collection', 'BGG collection'],
      ] as const).map(([value, label]) => (
        <Button
          key={value}
          type="button"
          variant="ghost"
          aria-pressed={mode === value}
          disabled={saving}
          className={cn(
            'h-9 min-w-0 px-3 transition-none active:scale-100 focus-visible:ring-offset-0',
            mode === value
              ? 'bg-background text-foreground shadow-sm hover:bg-background'
              : 'text-muted-foreground hover:bg-transparent hover:text-foreground'
          )}
          onClick={() => setMode(value)}
        >
          {label}
        </Button>
      ))}
    </div>}
    entryFooter={<>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" aria-hidden="true" />
        <span>or</span>
        <div className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <Button variant="outline" className="w-full" disabled={saving} onClick={() => setMode('manual')}>
        {desktop ? 'Create a game manually' : 'Scan a box or create manually'}
      </Button>
    </>}
  />;
}

function GameDiscoveryDialog({ title, onBack, headerAction, content, action, desktop, saving, onOpenChange }: GameDiscoveryLayout & {
  desktop: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const changeOpen = (open: boolean) => { if (!saving) onOpenChange(open); };
  const navigation = <Button key={onBack ? 'back' : 'close'} type="button" variant="secondary" size="icon"
    className="[&_svg]:size-5" aria-label={onBack ? 'Back' : 'Close'} disabled={saving} autoFocus={!!onBack}
    onClick={onBack ?? (() => changeOpen(false))}>
    {onBack ? <BackIcon aria-hidden="true" /> : <CloseIcon aria-hidden="true" />}
  </Button>;
  const body = <div className="relative min-h-0 flex-1">
    <div className={cn('h-full overflow-y-auto',
      desktop ? action ? 'pb-24' : 'pb-2' : action ? 'px-4 pb-[calc(var(--safe-bottom)+6rem)]' : 'px-4 pb-[calc(var(--safe-bottom)+1rem)]'
    )}>
      {content}
    </div>
    {action && <div className={cn('pointer-events-none absolute inset-x-0 flex justify-center px-4', desktop ? 'bottom-0' : 'bottom-[calc(var(--safe-bottom)+1rem)]')}>
      {action}
    </div>}
  </div>;
  if (desktop) return <Dialog open onOpenChange={changeOpen}>
    <DialogContent showCloseButton={false} className="!bottom-5 !left-auto !right-5 !top-5 !grid w-[440px] !max-w-none !translate-x-0 !translate-y-0 grid-rows-[auto_1fr] gap-4 overflow-hidden">
      <DialogHeader className="-mx-2 -mt-2 grid shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 space-y-0">
        {navigation}
        <DialogTitle className="text-balance text-center tabular-nums">{title}</DialogTitle>
        <div className="flex min-w-10 justify-end">{headerAction}</div>
        <DialogDescription className="sr-only">Search BoardGameGeek, paste a game link, or import a collection.</DialogDescription>
      </DialogHeader>
      {body}
    </DialogContent>
  </Dialog>;
  return <Drawer open onOpenChange={changeOpen} dismissible={!saving} repositionInputs={false}>
    <DrawerContent className="mt-0 flex h-dvh flex-col rounded-none border-t-0 pt-[var(--safe-top)]">
      <DrawerHeader className="grid shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2">
        {navigation}
        <DrawerTitle className="text-balance tabular-nums">{title}</DrawerTitle>
        <div className="flex min-w-10 justify-end">{headerAction}</div>
        <DrawerDescription className="sr-only">Search BoardGameGeek, paste a game link, or import a collection.</DrawerDescription>
      </DrawerHeader>
      {body}
    </DrawerContent>
  </Drawer>;
}
