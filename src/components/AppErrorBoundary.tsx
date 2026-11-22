import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import '../styles/button.css';
import '../styles/window.css';
import '../styles/desktop.css';

/** The saved edition. "Restart in Classic '97" removes only this key, in case a saved edition is the cause. */
const THEME_KEY = 'disclore97.theme';

export interface AppErrorBoundaryProps {
  children: ReactNode;
  /** Reloads the page. Tests pass a spy. */
  onRestart?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence for the whole app. Without it, an error thrown while drawing any window
 * unmounts everything and leaves only the teal desktop background: a blank screen with no clue.
 * With it, the error is logged to the console with its component stack, and a Win95-style message
 * box names it and offers a restart. The markup here is deliberately plain, so it cannot fail the
 * same way as the components it guards.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("DiscLore '97 stopped drawing the screen:", error, info.componentStack);
  }

  private restart = (): void => {
    if (this.props.onRestart) this.props.onRestart();
    else window.location.reload();
  };

  private restartClassic = (): void => {
    try {
      window.localStorage.removeItem(THEME_KEY);
    } catch {
      /* storage may be unavailable; restart anyway */
    }
    this.restart();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="desktop app-crash">
        <div className="window app-crash__box" role="alertdialog" aria-labelledby="app-crash-title" aria-describedby="app-crash-text">
          <div className="window-title-bar">
            <span className="window-title-text" id="app-crash-title">
              DiscLore &apos;97 - Error
            </span>
          </div>
          <div className="app-crash__body">
            <p id="app-crash-text" className="app-crash__text">
              DiscLore &apos;97 ran into a problem and stopped drawing the screen.
            </p>
            <pre className="app-crash__detail">{error.message || error.name}</pre>
            <div className="app-crash__buttons">
              <button type="button" className="bevel-button" onClick={this.restart}>
                Restart DiscLore &apos;97
              </button>
              <button type="button" className="bevel-button" onClick={this.restartClassic}>
                Restart in Classic &apos;97
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
