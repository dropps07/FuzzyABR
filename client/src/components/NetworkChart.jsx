import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const formatTime = (t) => new Date(t).toLocaleTimeString();

const AXIS_TICK = { fontSize: 11, fill: '#8b98a9' };
const TOOLTIP_STYLE = {
  backgroundColor: '#131a24',
  border: '1px solid #243044',
  borderRadius: '8px',
  color: '#e6edf3',
  fontSize: '12px',
};

export default function NetworkChart({ history }) {
  if (history.length === 0) return null;

  return (
    <div className="chart-wrapper panel">
      <h3>Network simulation &amp; quality</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#243044" />
          <XAxis dataKey="t" tick={AXIS_TICK} tickFormatter={formatTime} stroke="#243044" />
          <YAxis yAxisId="left" tick={AXIS_TICK} stroke="#243044" label={{ value: 'Mbps / s', angle: -90, position: 'insideLeft', fill: '#8b98a9', fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} stroke="#243044" label={{ value: 'ms', angle: 90, position: 'insideRight', fill: '#8b98a9', fontSize: 11 }} />
          <YAxis yAxisId="quality" orientation="right" domain={[0, 1080]} tick={AXIS_TICK} stroke="#243044" width={44} label={{ value: 'quality', angle: 90, position: 'insideRight', fill: '#8b98a9', fontSize: 11 }} />
          <Tooltip labelFormatter={formatTime} contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ color: '#8b98a9', fontSize: '12px' }} />
          <Line yAxisId="left" type="monotone" dataKey="bandwidth" stroke="#3b82f6" dot={false} isAnimationActive={false} name="Bandwidth (Mbps)" />
          <Line yAxisId="left" type="monotone" dataKey="buffer" stroke="#22c55e" dot={false} isAnimationActive={false} name="Buffer (s)" />
          <Line yAxisId="right" type="monotone" dataKey="delay" stroke="#f59e0b" dot={false} isAnimationActive={false} name="Delay (ms)" />
          <Line yAxisId="quality" type="monotone" dataKey="quality" stroke="#e879f9" dot={false} isAnimationActive={false} name="Quality (fuzzy output)" />
        </LineChart>
      </ResponsiveContainer>
      <p className="caption">
        Quality is the fuzzy engine&apos;s output value (144–1080) on its own axis — watch it follow bandwidth down and buffer up.
      </p>
    </div>
  );
}
