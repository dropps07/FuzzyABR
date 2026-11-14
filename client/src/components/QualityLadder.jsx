import { STANDARD_LADDER } from '../utils/fuzzy';

/**
 * QualityLadder — the HLS levels the player actually offers, with the
 * current level highlighted and a marker showing where the fuzzy engine's
 * output value sits on the 144–1080 scale.
 *
 * Until the player reports its real levels, the standard ladder is shown
 * dimmed as "expected" — it is not presented as the real one.
 */
export default function QualityLadder({ levels, currentLevelIndex, decision }) {
  const hasLevels = levels && levels.length > 0;
  // Rows shown high -> low. Real levels carry bitrate; the placeholder
  // ladder only has heights.
  const rows = hasLevels
    ? levels
        .map((lvl, index) => ({ height: lvl.height, bitrate: lvl.bitrate, index }))
        .sort((a, b) => b.height - a.height)
    : STANDARD_LADDER.slice()
        .sort((a, b) => b - a)
        .map((height) => ({ height, bitrate: null, index: -1 }));

  // Position of the fuzzy output value on the 144-1080 scale (0 = bottom).
  const markerPct =
    decision != null
      ? Math.max(0, Math.min(100, ((decision - 144) / (1080 - 144)) * 100))
      : null;

  return (
    <section className="panel ladder-panel">
      <h2>Quality ladder</h2>
      <div className="ladder">
        <div className="ladder-track">
          {markerPct !== null && (
            <span
              className="ladder-marker"
              style={{ bottom: `${markerPct}%` }}
              title={`Fuzzy output: ${Math.round(decision)}`}
            />
          )}
        </div>
        <ul className="ladder-list">
          {rows.map((row) => {
            const isCurrent = hasLevels && row.index === currentLevelIndex;
            return (
              <li
                key={row.height}
                className={`ladder-row ${isCurrent ? 'current' : ''} ${
                  hasLevels ? '' : 'placeholder'
                }`}
              >
                <span className="ladder-height">{row.height}p</span>
                <span className="ladder-bitrate">
                  {row.bitrate
                    ? `${(row.bitrate / 1000).toFixed(0)} kbps`
                    : '—'}
                </span>
                <span className="ladder-state">
                  {isCurrent ? '▶ playing' : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="caption">
        {hasLevels
          ? 'Levels reported by the player for this stream.'
          : 'Waiting for the player to report the stream levels…'}
        {markerPct !== null &&
          ` Marker = fuzzy output (${Math.round(decision)}).`}
      </p>
    </section>
  );
}
