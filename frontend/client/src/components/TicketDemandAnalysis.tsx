import React, { useState, useEffect } from 'react';
import { API_BASE } from '../lib/api';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface TicketDemandData {
  ticketType: string;
  ticketName: string;
  totalBookings: number;
  totalPeople: number;
  totalAdults: number;
  totalKids: number;
  revenue: number;
  averagePeoplePerBooking: number;
  demandScore: number;
  upgradePotential: number;
  peakHours: string[];
  weeklyTrend: number[];
  monthlyTrend: number[];
}

interface UpgradeInsight {
  fromTicketType: string;
  toTicketType: string;
  upgradeCount: number;
  upgradeRevenue: number;
  upgradeRate: number;
  potentialRevenue: number;
}

interface AnalysisData {
  period: string;
  highestDemand: TicketDemandData;
  ranking: TicketDemandData[];
  upgradeInsights: UpgradeInsight[];
  recommendations: string[];
  summary: {
    totalBookings: number;
    totalPeople: number;
    totalRevenue: number;
    mostPopularHour: string;
    growthRate: number;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const TicketDemandAnalysis: React.FC = () => {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAnalysisData();
  }, [days]);

  const fetchAnalysisData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/ticket-demand-analysis/analysis?days=${days}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analysis data');
      }
      const analysisData = await response.json();
      setData(analysisData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading ticket demand analysis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-gray-800">No data available</div>
      </div>
    );
  }

  // Prepare chart data
  const demandComparisonData = data.ranking.map(item => ({
    name: item.ticketName,
    bookings: item.totalBookings,
    people: item.totalPeople,
    revenue: item.revenue,
    demandScore: item.demandScore,
    upgradePotential: item.upgradePotential
  }));

  const pieChartData = data.ranking.map(item => ({
    name: item.ticketName,
    value: item.totalBookings
  }));

  const weeklyTrendData = data.ranking[0]?.weeklyTrend.map((count, index) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
    ...data.ranking.reduce((acc, ticket) => {
      acc[ticket.ticketName] = ticket.weeklyTrend[index];
      return acc;
    }, {} as Record<string, number>)
  })) || [];

  const radarData = data.ranking.map(item => ({
    ticket: item.ticketName,
    bookings: item.totalBookings / Math.max(...data.ranking.map(d => d.totalBookings)) * 100,
    revenue: item.revenue / Math.max(...data.ranking.map(d => d.revenue)) * 100,
    people: item.totalPeople / Math.max(...data.ranking.map(d => d.totalPeople)) * 100,
    demandScore: item.demandScore / Math.max(...data.ranking.map(d => d.demandScore)) * 100
  }));

  const upgradeChartData = data.upgradeInsights.slice(0, 5).map(insight => ({
    from: `₹${insight.fromTicketType}`,
    to: `₹${insight.toTicketType}`,
    revenue: insight.upgradeRevenue,
    rate: insight.upgradeRate,
    potential: insight.potentialRevenue
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Ticket Type Demand Analysis</h1>
          <div className="flex items-center space-x-4">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-gray-600">Analysis Period: {data.period}</div>
      </div>

      {/* Highest Demand Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">🏆 Highest Demand Ticket Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-gray-600">Ticket Type</div>
            <div className="text-lg font-bold text-blue-600">{data.highestDemand.ticketName}</div>
            <div className="text-sm text-gray-500">₹{data.highestDemand.ticketType}</div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-gray-600">Total Bookings</div>
            <div className="text-lg font-bold text-green-600">{data.highestDemand.totalBookings}</div>
            <div className="text-sm text-gray-500">{data.highestDemand.totalPeople} people</div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-gray-600">Revenue</div>
            <div className="text-lg font-bold text-purple-600">₹{data.highestDemand.revenue.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Demand Score: {data.highestDemand.demandScore.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Bookings</div>
          <div className="text-xl font-bold text-gray-800">{data.summary.totalBookings}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total People</div>
          <div className="text-xl font-bold text-gray-800">{data.summary.totalPeople}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Revenue</div>
          <div className="text-xl font-bold text-green-600">₹{data.summary.totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Growth Rate</div>
          <div className={`text-xl font-bold ${data.summary.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {data.summary.growthRate >= 0 ? '+' : ''}{data.summary.growthRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demand Comparison Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Demand Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={demandComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="bookings" fill="#8884d8" name="Bookings" />
              <Bar dataKey="people" fill="#82ca9d" name="People" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Comparison */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={demandComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#ffc658" name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Market Share Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Market Share by Bookings</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Weekly Booking Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Legend />
              {data.ranking.map((ticket, index) => (
                <Line
                  key={ticket.ticketType}
                  type="monotone"
                  dataKey={ticket.ticketName}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Radar Chart for Multi-dimensional Analysis */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Multi-dimensional Performance Analysis</h3>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="ticket" />
            <PolarRadiusAxis angle={90} domain={[0, 100]} />
            <Radar name="Bookings" dataKey="bookings" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
            <Radar name="Revenue" dataKey="revenue" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
            <Radar name="People" dataKey="people" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} />
            <Radar name="Demand Score" dataKey="demandScore" stroke="#ff7300" fill="#ff7300" fillOpacity={0.6} />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Upgrade Insights */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">💡 Upgrade Insights</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={upgradeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="from" />
                <YAxis />
                <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#8884d8" name="Upgrade Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {data.upgradeInsights.slice(0, 3).map((insight, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-semibold">₹{insight.fromTicketType} → ₹{insight.toTicketType}</span>
                    <div className="text-sm text-gray-600">
                      {insight.upgradeCount} upgrades ({insight.upgradeRate.toFixed(1)}% rate)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">₹{insight.upgradeRevenue.toLocaleString()}</div>
                    <div className="text-sm text-gray-500">Potential: ₹{insight.potentialRevenue.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Recommendations</h3>
        <div className="space-y-3">
          {data.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                {index + 1}
              </div>
              <div className="text-gray-800">{recommendation}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TicketDemandAnalysis;
