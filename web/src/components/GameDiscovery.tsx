import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Game } from '../models/Game';
import { bggIdFromInput, findBggMatch, type BggResult } from '../lib/bgg';
import { cn } from '../lib/utils';
import { loadBggCollection, searchBgg } from '../services/bggService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';

export interface GameDiscoveryLayout {
  title: string;
  onBack?: () => void;
  headerAction?: ReactNode;
  content: ReactNode;
  action?: ReactNode;
}

interface Props {
  mode: 'search' | 'collection';
  initialQuery: string;
  games: Game[];
  myIds: Set<string>;
  entryHeader?: ReactNode;
  entryFooter?: ReactNode;
  renderLayout: (layout: GameDiscoveryLayout) => ReactNode;
  onImport: (games: BggResult[], onStatus: (message: string) => void) => Promise<{ added: number[]; failed: { bggId: number; title: string; error: string }[] }>;
  onAddExisting: (game: Game) => Promise<void>;
  onSavingChange: (saving: boolean) => void;
}

export function GameDiscovery({ mode, initialQuery, games, myIds, entryHeader, entryFooter, renderLayout, onImport, onAddExisting, onSavingChange }: Props) {
  const [query, setQuery] = useState(mode === 'search' ? initialQuery : '');
  const [results, setResults] = useState<BggResult[] | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<number>>(new Set());
  const [addedLocal, setAddedLocal] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'lookup' | 'save' | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const request = useRef<AbortController | null>(null);
  const collection = mode === 'collection';
  useEffect(() => () => request.current?.abort(), []);

  const inMyGames = (result: BggResult) => {
    // A partial write may already put the game in My Games; keep its failed
    // cover/heart step selectable so the user can finish the import.
    if (failedIds.has(result.bggId)) return false;
    const existing = findBggMatch(games, result);
    return added.has(result.bggId) || !!existing && (myIds.has(existing.id) || addedLocal.has(existing.id));
  };
  const available = (results ?? []).filter((game) => !inMyGames(game));
  const selectedGames = available.filter((game) => selected.has(game.bggId));
  const localMatches = !collection && query.trim().length >= 2 && !bggIdFromInput(query)
    ? games.filter((game) => game.title.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 10) : [];

  const lookup = async (event: FormEvent) => {
    event.preventDefault();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy('lookup');
    setResults(null);
    setError('');
    setStatus(collection ? 'Loading owned games…' : 'Searching BoardGameGeek…');
    try {
      const options = { signal: controller.signal, onStatus: setStatus };
      const data = await (collection ? loadBggCollection(query, options) : searchBgg(query, options));
      if (controller.signal.aborted) return;
      setResults(data.games);
      setTotal(data.total);
      setVisibleCount(50);
      setSelected(new Set(collection ? data.games.filter((game) => !inMyGames(game)).map((game) => game.bggId) : []));
      setStatus('');
    } catch (error) {
      if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : 'Could not load games.'); setStatus(''); }
    } finally { if (!controller.signal.aborted) setBusy(null); }
  };

  const save = async (choices: BggResult[]) => {
    setBusy('save');
    onSavingChange(true);
    setError('');
    setStatus('Adding games…');
    try {
      const result = await onImport(choices, setStatus);
      setFailedIds((prev) => new Set([...prev].filter((id) => !choices.some((game) => game.bggId === id)).concat(result.failed.map((game) => game.bggId))));
      setAdded((prev) => new Set([...prev, ...result.added]));
      setSelected((prev) => new Set([...prev].filter((id) => !result.added.includes(id))));
      setStatus(`Added ${result.added.length} ${result.added.length === 1 ? 'game' : 'games'} to My Games.`);
      if (result.failed.length) setError(`${result.failed.length} could not be added. ${result.failed[0].title}: ${result.failed[0].error} You can retry the remaining games.`);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not add games.'); setStatus(''); }
    finally { setBusy(null); onSavingChange(false); }
  };

  const addExisting = async (game: Game) => {
    setBusy('save');
    onSavingChange(true);
    setError('');
    try {
      await onAddExisting(game);
      setAddedLocal((prev) => new Set([...prev, game.id]));
      setStatus(`Added ${game.title} to My Games.`);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not add game.'); }
    finally { setBusy(null); onSavingChange(false); }
  };

  const content = (
    <div className="space-y-5">
      {results === null && <>
        {entryHeader}
        <form onSubmit={lookup} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`bgg-${mode}`}>{collection ? 'BGG username or profile link' : 'Game name or BGG link'}</Label>
            <Input id={`bgg-${mode}`} value={query} maxLength={collection ? 200 : 500} autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false}
              placeholder={collection ? 'Your BoardGameGeek username' : 'Wingspan or boardgamegeek.com/…'} disabled={busy === 'save'}
              onChange={(event) => {
                request.current?.abort(); setBusy(null); setQuery(event.target.value); setResults(null); setError(''); setStatus('');
              }} />
          </div>
          <Button type="submit" className="w-full" disabled={!!busy || !query.trim()}>
            {busy === 'lookup' ? 'Loading…' : collection ? 'Preview collection' : 'Search'}
          </Button>
        </form>
      </>}

      <div aria-live="polite" role="status" className={cn('text-pretty text-sm text-muted-foreground tabular-nums', !status && 'sr-only')}>{status}</div>
      {error && <p role="alert" className="text-pretty text-sm text-destructive">{error}</p>}

      {localMatches.length > 0 && (
        <section aria-label="Games already in Skunk" className="space-y-2">
          <h3 className="text-balance text-sm font-semibold">Already in Skunk</h3>
          <ul className="divide-y divide-border">
            {localMatches.map((game) => {
              const mine = myIds.has(game.id) || addedLocal.has(game.id);
              return <li key={game.id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1 text-sm font-medium">{game.title}</span>
                <Button size="sm" variant="outline" disabled={!!busy || mine} onClick={() => void addExisting(game)} aria-label={mine ? `${game.title} is in My Games` : `Add ${game.title}`}>
                  {mine ? 'Added' : 'Add'}
                </Button>
              </li>;
            })}
          </ul>
        </section>
      )}

      {results !== null && (
        <section aria-label={collection ? 'BGG collection' : 'BGG search results'} className="space-y-3">
          {results.length === 0 ? (
            <p className="text-pretty text-sm text-muted-foreground">{collection ? 'No owned board games found. Check the username and which games are marked as owned on BGG.' : 'No games found. Try another title or paste the game’s BGG link.'}</p>
          ) : <>
            {!collection && <h3 className="text-balance text-sm font-semibold">From BoardGameGeek</h3>}
            {total > results.length && <p className="text-pretty text-sm text-muted-foreground">Showing the first {results.length} of {total} matches. Use a more specific name to narrow the search.</p>}
            <ul className="divide-y divide-border">
              {results.slice(0, visibleCount).map((game) => {
                const mine = inMyGames(game);
                return <li key={game.bggId} className="flex items-center gap-3 py-3">
                  {collection && <Checkbox checked={mine || selected.has(game.bggId)} disabled={!!busy || mine} aria-label={`Select ${game.title}`}
                    onCheckedChange={(checked) => setSelected((prev) => { const next = new Set(prev); if (checked) next.add(game.bggId); else next.delete(game.bggId); return next; })} />}
                  {game.thumbnail && <img src={game.thumbnail} alt="" loading="lazy" className="size-12 shrink-0 rounded-md bg-muted object-contain" />}
                  <div className="min-w-0 flex-1">
                    <a href={`https://boardgamegeek.com/boardgame/${game.bggId}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline">{game.title}</a>
                    <p className="text-xs text-muted-foreground tabular-nums">{[game.year, mine ? collection ? 'In My Games' : null : findBggMatch(games, game) ? 'Already in Skunk' : null].filter(Boolean).join(' · ')}</p>
                  </div>
                  {!collection && <Button size="sm" variant="outline" disabled={!!busy || mine} onClick={() => void save([game])} aria-label={mine ? `${game.title} is in My Games` : `Add ${game.title}`}>
                    {mine ? 'Added' : 'Add'}
                  </Button>}
                </li>;
              })}
            </ul>
            {results.length > visibleCount && <Button variant="outline" className="w-full" onClick={() => setVisibleCount((count) => count + 50)}>Show more games</Button>}
          </>}
        </section>
      )}
      <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer" className="mx-auto block w-fit">
        <img src="https://cf.geekdo-images.com/HZy35cmzmmyV9BarSuk6ug__small/img/gbE7sulIurZE_Tx8EQJXnZSKI6w=/fit-in/200x150/filters:strip_icc()/pic7779581.png" alt="Powered by BGG" width={120} height={35} />
      </a>
      {results === null && entryFooter}
    </div>
  );

  return renderLayout({
    title: results === null ? 'Add games' : `${total} ${total === 1 ? 'game' : 'games'} found`,
    onBack: results === null ? undefined : () => {
      setResults(null); setSelected(new Set()); setError(''); setStatus('');
    },
    headerAction: collection && results !== null && results.length > 0 ? (
      <Button type="button" variant="ghost" size="sm" disabled={!!busy || !available.length}
        onClick={() => setSelected(new Set(selectedGames.length === available.length ? [] : available.map((game) => game.bggId)))}>
        {selectedGames.length === available.length && available.length ? 'Deselect all' : 'Select all'}
      </Button>
    ) : undefined,
    content,
    action: collection && results !== null && results.length > 0 ? (
      <Button size="lg" className="pointer-events-auto min-w-48 max-w-full shadow-lg tabular-nums" disabled={!!busy || !selectedGames.length} onClick={() => void save(selectedGames)}>
        {busy === 'save' ? 'Adding…' : `Add ${selectedGames.length} ${selectedGames.length === 1 ? 'game' : 'games'}`}
      </Button>
    ) : undefined,
  });
}
