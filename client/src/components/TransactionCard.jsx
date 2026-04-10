export default function TransactionCard({ transaction, onDelete }) {
  const { id, type, amount, category, emoji, note, date } = transaction;

  return (
    <div className="transaction-card">
      <div className={`transaction-emoji ${type === 'income' ? 'income-bg' : 'expense-bg'}`}>
        {emoji || (type === 'income' ? '💰' : '💸')}
      </div>
      <div className="transaction-info">
        <div className="category">{category}</div>
        {note && <div className="note">{note}</div>}
      </div>
      <div className={`transaction-amount ${type}`}>
        {type === 'income' ? '+' : '-'}¥{amount.toFixed(2)}
      </div>
      {onDelete && (
        <div className="transaction-actions">
          <button
            className="btn btn-danger"
            onClick={() => onDelete(id)}
            id={`delete-${id}`}
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}
