import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const formatTime = (t) => new Date(t).toLocaleTimeString();

const AXIS_TICK = { fontSize: 11, fill: '#a3a3a3' };
const TOOLTIP_STYLE = {
  backgroundColor: '#0a0a0a',
  border: '1px solid #1c1c1c',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '12px',
};

export default function NetworkChart({ history }) {
  if (history.length === 0) return null;

  return (
    <div className="chart-wrapper panel">
      <h3>Network simulation &amp; quality</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" />
          <XAxis dataKey="t" tick={AXIS_TICK} tickFormatter={formatTime} stroke="#1c1c1c" />
          <YAxis yAxisId="left" tick={AXIS_TICK} stroke="#1c1c1c" label={{ value: 'Mbps / s', angle: -90, position: 'insideLeft', fill: '#a3a3a3', fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} stroke="#1c1c1c" label={{ value: 'ms', angle: 90, position: 'insideRight', fill: '#a3a3a3', fontSize: 11 }} />
          <YAxis yAxisId="quality" orientation="right" domain={[0, 1080]} tick={AXIS_TICK} stroke="#1c1c1c" width={44} label={{ value: 'quality', angle: 90, position: 'insideRight', fill: '#a3a3a3', fontSize: 11 }} />
          <Tooltip labelFormatter={formatTime} contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ color: '#a3a3a3', fontSize: '12px' }} />
          {/* Monochrome series: white/grey tones only, distinguished by
              shade, weight and dash. Quality is the white, boldest line. */}
          <Line yAxisId="left" type="monotone" dataKey="bandwidth" stroke="#e5e5e5" strokeWidth={2} dot={false} isAnimationActive={false} name="Bandwidth (Mbps)" />
          <Line yAxisId="left" type="monotone" dataKey="buffer" stroke="#a3a3a3" strokeWidth={2} strokeDasharray="6 3" dot={false} isAnimationActive={false} name="Buffer (s)" />
          <Line yAxisId="right" type="monotone" dataKey="delay" stroke="#737373" strokeWidth={2} strokeDasharray="2 3" dot={false} isAnimationActive={false} name="Delay (ms)" />
          <Line yAxisId="quality" type="monotone" dataKey="quality" stroke="#ffffff" strokeWidth={3} dot={false} isAnimationActive={false} name="Quality (fuzzy output)" />
        </LineChart>
      </ResponsiveContainer>
      <p className="caption">
        Quality is the fuzzy engine&apos;s output value (144–1080) on its own axis — watch it follow bandwidth down and buffer up.
      </p>
    </div>
  );
}
