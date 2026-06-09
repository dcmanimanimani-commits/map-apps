interface FeedbackBannerProps {
  message: string;
  type: 'success' | 'error' | 'info' | null;
}

export function FeedbackBanner({ message, type }: FeedbackBannerProps) {
  if (!type || !message) return <div className="feedback-banner empty" />;

  return (
    <div className={`feedback-banner ${type}`} role="status">
      {message}
    </div>
  );
}
