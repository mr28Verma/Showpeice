import { FAQTabsCard } from '@/components/spectrumui/faq-tabs-card'
import { FeedbackCard } from '@/components/spectrumui/feedback-card'
import './HelpPage.css'

export function HelpPage() {
  return <main className="help-page">
    <header className="help-page-heading">
      <div className="eyebrow"><span className="eyebrow-line"/> HELP &amp; FEEDBACK</div>
      <h1>How can we help?</h1>
      <p>Find answers for collecting and sharing art, or tell us about your experience.</p>
    </header>

    <div className="help-page-content">
      <section aria-labelledby="help-faq-heading">
        <h2 className="sr-only" id="help-faq-heading">Frequently asked questions</h2>
        <FAQTabsCard/>
      </section>
      <section aria-labelledby="help-feedback-heading">
        <h2 className="sr-only" id="help-feedback-heading">Rate your experience</h2>
        <FeedbackCard/>
      </section>
    </div>
  </main>
}
