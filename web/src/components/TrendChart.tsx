import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js'
import { useEffect, useState } from 'react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Title)

export interface TrendDataset {
  label: string
  data: number[]
  color: string
}

interface Props {
  labels: string[]
  datasets: TrendDataset[]
}

function TrendChart({ labels, datasets }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (labels.length === 0) return
    
    setLoading(true)
    setError(null)
    
    // Simplified data fetching - in real app this would call API
    const mockData = {
      labels: labels.slice(0, 12),
      datasets: [
        {
          label: '代码提交',
          data: [10, 15, 20, 18, 25, 22, 30, 28, 35, 33, 38, 36],
          color: '#4f46e5'
        },
        {
          label: '代码审查',
          data: [5, 8, 12, 10, 15, 12, 18, 15, 20, 18, 22, 20],
          color: '#10b981'
        }
      ]
    }
    
    setLoading(false)
  }, [labels])

  if (loading) {
    return <div className="chart-skeleton">加载中...</div>
  }

  if (error) {
    return <div className="chart-error">{error}</div>
  }

  const data = {
    labels,
    datasets: datasets.map((ds) => ({
      ...ds,
      borderColor: ds.color,
      backgroundColor: ds.color + '20',
      tension: 0.2,
      pointRadius: 2,
      pointHoverRadius: 3,
    })),
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#666',
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#111',
        bodyColor: '#111',
        borderColor: '#ddd',
        borderWidth: 1,
        cornerRadius: 4,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#666',
        },
        title: {
          display: true,
          text: '数量',
          color: '#666',
          font: { size: 12 }
        },
      },
      x: {
        ticks: {
          color: '#666',
          font: { size: 12 },
        },
        title: {
          display: true,
          text: '日期',
          color: '#666',
          font: { size: 12 }
        },
      },
    },
  }

  return (
    <div className="chart-container" style={{ height: 200 }}>
      <Line
        data={data}
        options={options}
        className="chart-simple"
      />
    </div>
  )
}

export default TrendChart