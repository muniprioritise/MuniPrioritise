import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line 
} from 'recharts';
import benchmarkData from '../utils/benchmark_results.json';

const AlgorithmComparisonPage = () => {
  const { algorithms, alphaSensitivity } = benchmarkData;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Algorithm Benchmarking</h1>

      {/* Comparison Table */}
      <div className="bg-white p-4 rounded shadow overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4">Metrics Overview</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Algorithm</th>
              <th className="px-4 py-2 text-left">Gini Coefficient</th>
              <th className="px-4 py-2 text-left">Avg Response Time (mins)</th>
              <th className="px-4 py-2 text-left">Comp. Time (ms)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {algorithms.map((algo) => (
              <tr key={algo.name}>
                <td className="px-4 py-2 font-medium">{algo.name}</td>
                <td className="px-4 py-2">{algo.gini}</td>
                <td className="px-4 py-2">{algo.avgResponseTime}</td>
                <td className="px-4 py-2">{algo.compTime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gini & Response Time Chart */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Gini vs Avg Response Time</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={algorithms}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="gini" name="Gini Coeff" fill="#8884d8" />
                <Bar yAxisId="right" dataKey="avgResponseTime" name="Response Time" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Computational Time Chart */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Computational Complexity</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={algorithms}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="compTime" name="Comp Time (ms)" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alpha Sensitivity Chart (Hybrid Only) */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Hybrid Alpha Sensitivity</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={alphaSensitivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="alpha" name="Alpha Weight" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="gini" name="Gini Coeff" stroke="#8884d8" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="avgResponseTime" name="Response Time" stroke="#82ca9d" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AlgorithmComparisonPage;