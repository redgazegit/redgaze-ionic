import { navigateToGif } from './gif-navigation';
import { fakeGif } from '../testing/test-utils';

function makeContext(storiesNavigation: boolean) {
  return {
    router: { navigate: vi.fn() },
    settings: { get: () => ({ storiesNavigation }) },
    queue: { setQueue: vi.fn() },
  } as any;
}

describe('navigateToGif', () => {
  const gifs = [fakeGif({ id: 'g1' }), fakeGif({ id: 'g2' })];

  it('should queue the feed and open stories when storiesNavigation is on', () => {
    const ctx = makeContext(true);
    const generator = () => (async function* () {})();

    navigateToGif(ctx, 'g1', 0, gifs, generator);

    expect(ctx.queue.setQueue).toHaveBeenCalledWith(gifs, 0, generator);
    expect(ctx.router.navigate).toHaveBeenCalledWith(['/stories', 'g1']);
  });

  it('should queue without a generator when none is provided', () => {
    const ctx = makeContext(true);

    navigateToGif(ctx, 'g2', 1, gifs);

    expect(ctx.queue.setQueue).toHaveBeenCalledWith(gifs, 1, undefined);
    expect(ctx.router.navigate).toHaveBeenCalledWith(['/stories', 'g2']);
  });

  it('should open watch and leave the queue alone when storiesNavigation is off', () => {
    const ctx = makeContext(false);

    navigateToGif(ctx, 'g1', 0, gifs, () => (async function* () {})());

    expect(ctx.queue.setQueue).not.toHaveBeenCalled();
    expect(ctx.router.navigate).toHaveBeenCalledWith(['/watch', 'g1']);
  });
});
