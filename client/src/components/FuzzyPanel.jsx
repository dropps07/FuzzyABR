import { useMemo } from 'react';
import { fuzzify, evaluateRules } from '../utils/fuzzy';

/**
 * FuzzyPanel — "Why this quality?"
 *
 * Shows, for the inputs that were actually sent to the engine:
 *  - how strongly each fuzzy label applies (membership bars),
 *  - which of the 6 rules fired and how strongly,
 *  - the defuzzified output from the server vs the HLS level it mapped to.
 *
 * Visualisation only: the memberships and rule strengths are computed in
 * the browser from the same functions as engine/fuzzy_engine.py. The
 * authoritative decision still comes from the server / Flask engine.
 */

const INPUT_META = [
  { key: 'bandwidth', title: 'Bandwidth', format: (v) => `${v.toFixed(1)} Mbps` },
  { key: 'buffer', title: 'Buffer', format: (v) => `${v.toFixed(1)} s` },
  { key: 'delay', title: 'Delay', format: (v) => `${Math.round(v)} ms` },
];

function MembershipRow({ label, value }) {
  const active = value > 0;
  return (
    <div className={`membership-row ${active ? 'active' : ''}`}>
      <span className="membership-label">{label}</span>
      <span className="membership-bar">
        <span
          className="membership-fill"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </span>
      <span className="membership-value">{value.toFixed(2)}</span>
    </div>
  );
}

export default function FuzzyPanel({ inputs, decision, mappedLevel, collectedRules = new Set(), onResetCollected = () => {} }) {
  const { memberships, rules } = useMemo(() => {
    if (!inputs) return { memberships: null, rules: [] };
    const m = fuzzify(inputs.bandwidth, inputs.buffer, inputs.delay);
    return { memberships: m, rules: evaluateRules(m) };
  }, [inputs]);

  if (!inputs || !memberships) {
    return (
      <section className="panel fuzzy-panel">
        <h2>Why this quality?</h2>
        <p className="hint">Waiting for the first decision from the engine…</p>
      </section>
    );
  }

  const firedCount = rules.filter((r) => r.strength > 0).length;
  const collectedCount = rules.filter((r) => collectedRules.has(r.id)).length;

  return (
    <section className="panel fuzzy-panel">
      <h2>Why this quality?</h2>

      {INPUT_META.map(({ key, title, format }) => (
        <div className="fuzzy-input" key={key}>
          <div className="fuzzy-input-head">
            <span className="fuzzy-input-title">{title}</span>
            <span className="fuzzy-input-value">{format(inputs[key])}</span>
          </div>
          {Object.entries(memberships[key]).map(([label, value]) => (
            <MembershipRow key={label} label={label} value={value} />
          ))}
        </div>
      ))}

      <div className="rules">
        <div className="rules-head">
          <span className="rules-title">Rules</span>
          <span className="rules-count">
            {firedCount} of {rules.length} fired
          </span>
        </div>
        <div className="rules-collected">
          <span>
            ✓ {collectedCount} of {rules.length} collected
          </span>
          {collectedCount > 0 ? (
            <button type="button" className="rules-reset" onClick={onResetCollected}>
              Reset
            </button>
          ) : null}
        </div>
        {rules.map((rule) => {
          const fired = rule.strength > 0;
          const collected = collectedRules.has(rule.id);
          return (
            <div className={`rule-row ${fired ? 'fired' : ''}${collected ? ' collected' : ''}`} key={rule.id}>
              <span className="rule-check">{collected ? '✓' : ''}</span>
              <span className="rule-id">{rule.id}</span>
              <span className="rule-text">{rule.text}</span>
              <span className="rule-bar">
                <span
                  className="rule-fill"
                  style={{ width: `${Math.round(rule.strength * 100)}%` }}
                />
              </span>
              <span className="rule-strength">
                {fired ? rule.strength.toFixed(2) : '0.00'}
              </span>
              <span className={`rule-output rule-output-${rule.output}`}>
                {rule.output}
              </span>
            </div>
          );
        })}
      </div>

      <div className="fuzzy-output">
        <span className="label">Defuzzified output (engine)</span>
        <span className="value">
          {decision != null ? `${Math.round(decision)}` : '…'}
        </span>
        <span className="fuzzy-output-arrow">→</span>
        <span className="label">Mapped HLS level</span>
        <span className="value">
          {mappedLevel != null ? `${mappedLevel}p` : '…'}
        </span>
      </div>

      <p className="caption">
        Memberships and rule strengths are computed in your browser from the
        same functions as <code>engine/fuzzy_engine.py</code> — they explain
        the decision, they don&apos;t make it. The quality value comes from the
        Flask engine via the server. Rules you trigger stay checked off —
        change the settings to collect all six, and use Reset to start over.
      </p>
    </section>
  );
}
