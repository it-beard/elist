import { Component } from 'react';
import { LangContext } from '../hooks/useLang.jsx';

/** Апошні рубеж: замест пустога экрана (напрыклад, ад сапсаванай спасылкі) — паведамленне і выхад на галоўную. */
export default class ErrorBoundary extends Component {
  static contextType = LangContext;

  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  reset = () => { location.hash = ''; this.setState({ error: null }); };

  render() {
    if (!this.state.error) return this.props.children;
    const { t } = this.context;
    return (
      <main className="wrap">
        <h2 className="page-title">{t.errTitle}</h2>
        <p className="summary error">{String(this.state.error?.message || this.state.error)}</p>
        <p className="hint">{t.errHint}</p>
        <p className="rec-actions">
          <button type="button" className="chip" onClick={this.reset}>{t.errRetry}</button>
          <a className="chip" href={import.meta.env.BASE_URL}>{t.errHome}</a>
        </p>
      </main>
    );
  }
}
