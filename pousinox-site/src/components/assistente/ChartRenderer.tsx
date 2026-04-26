import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import s from './ChartRenderer.module.css'

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'area'
  title?: string
  data: Record<string, unknown>[]
  xKey?: string
  yKeys?: string[]
  colors?: string[]
}

const DEFAULT_COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#ea580c', '#d946ef', '#059669', '#dc2626', '#eab308']

export default function ChartRenderer({ config }: { config: ChartConfig }) {
  const { type, title, data, xKey = 'name', yKeys = ['value'], colors = DEFAULT_COLORS } = config

  if (!data?.length) return null

  return (
    <div className={s.wrap}>
      {title && <h4 className={s.title}>{title}</h4>}
      <div className={s.chartBox}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {yKeys.map((k, i) => (
                <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} maxBarSize={40} />
              ))}
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              {yKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {yKeys.map((k, i) => (
                <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          ) : type === 'area' ? (
            <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              {yKeys.map((k, i) => (
                <Area key={k} type="monotone" dataKey={k} fill={colors[i % colors.length]} fillOpacity={0.15} stroke={colors[i % colors.length]} strokeWidth={2} />
              ))}
            </AreaChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey={yKeys[0]}
                nameKey={xKey}
                cx="50%" cy="50%"
                outerRadius={90}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={10}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12 }} />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
