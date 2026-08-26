import { useEffect, useState } from 'react';
import ResultItem from './ResultItem.jsx';

const PAGE = 50;

export default function ResultList({ results, tokens, chunkSize }) {
  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [results]);
  const rest = results.length - limit;
  return (
    <>
      <ol className="results">
        {results.slice(0, limit).map((it) => <ResultItem key={it.i} item={it} tokens={tokens} chunkSize={chunkSize} />)}
      </ol>
      {rest > 0 && (
        <button type="button" className="more" onClick={() => setLimit((l) => l + PAGE)}>
          Паказаць яшчэ (засталося {rest})
        </button>
      )}
    </>
  );
}
