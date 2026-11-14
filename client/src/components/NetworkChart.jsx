import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const formatTime = (t) => new Date(t).toLocaleTimeString();

export default function NetworkChart({ history }) {
  if (history.length === 0) return null;

  return (
    <div className="chart-wrapper">
      <h3>Network Simulation</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="t" tick={{ fontSize: 11 }} tickFormatter={formatTime} />
          <YAxis yAxisId="left" label={{ value: 'Mbps / s', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'ms', angle: 90, position: 'insideRight' }} />
          <Tooltip labelFormatter={formatTime} />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="bandwidth" stroke="#2563eb" dot={false} isAnimationActive={false} name="Bandwidth (Mbps)" />
          <Line yAxisId="left" type="monotone" dataKey="buffer" stroke="#16a34a" dot={false} isAnimationActive={false} name="Buffer (s)" />
          <Line yAxisId="right" type="monotone" dataKey="delay" stroke="#ea580c" dot={false} isAnimationActive={false} name="Delay (ms)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}