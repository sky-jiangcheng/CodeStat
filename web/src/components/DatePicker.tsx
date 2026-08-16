import { useTranslation } from 'react-i18next'
import { getToday, getYesterday } from '../utils/dates'

interface Props {
  value: string
  onChange: (date: string) => void
}

function DatePicker({ value, onChange }: Props) {
  const { t } = useTranslation()
  const today = getToday()
  const yesterday = getYesterday()

  return (
    <div className="date-picker">
      <button
        className={`btn btn-sm ${value === yesterday ? 'btn-active' : ''}`}
        onClick={() => onChange(yesterday)}
      >
        {t('common.yesterday')}
      </button>
      <button
        className={`btn btn-sm ${value === today ? 'btn-active' : ''}`}
        onClick={() => onChange(today)}
      >
        {t('common.today')}
      </button>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-input date-input"
      />
    </div>
  )
}

export default DatePicker
