import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

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
          text: t('trend.count', { defaultValue: 'Count' }),
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
          text: t('summaryBar.date', { defaultValue: 'Date' }),
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