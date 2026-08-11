// __tests__/navigation.test.ts — locks the safeBack() contract:
//   - with history  → router.back()
//   - without history (deep link) → router.replace('/(tabs)') so the
//     dead-end screen is replaced, never left underneath the stack.

jest.mock('expo-router', () => ({
  router: {
    canGoBack: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

import { router } from 'expo-router';
import { safeBack } from '../lib/navigation';

const mockCanGoBack = router.canGoBack as jest.Mock;
const mockBack = router.back as jest.Mock;
const mockReplace = router.replace as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('safeBack', () => {
  it('calls router.back() when there is history to go back to', () => {
    mockCanGoBack.mockReturnValue(true);

    safeBack();

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces with the tabs route when there is no history (deep link)', () => {
    mockCanGoBack.mockReturnValue(false);

    safeBack();

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
