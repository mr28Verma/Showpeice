import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import './faq-tabs-card.css'

type FAQ = { question: string; answer: string }
type FAQTab = { label: string; faqs: FAQ[] }

type FAQTabsCardProps = {
  tabs?: FAQTab[]
  onFooterClick?: () => void
}

const defaultTabs: FAQTab[] = [
  {
    label: 'General',
    faqs: [
      { question: 'What is Showpeice?', answer: 'Showpeice is a platform for discovering, collecting, and sharing art from independent artists.' },
      { question: 'How do I create an account?', answer: 'Sign up using the available registration options to create your account and explore the marketplace.' },
      { question: 'How can I contact support?', answer: 'Support contact details are not configured in the current application. The Contact Support button below will show this status.' },
    ],
  },
  {
    label: 'Buying Art',
    faqs: [
      { question: 'How do I purchase an artwork?', answer: 'Browse the gallery and add an artwork to your bag. Checkout is not connected in the current application yet, so orders cannot be placed here.' },
      { question: 'How can I track my order?', answer: 'Order tracking is not available yet. The cart currently keeps your selections for this session.' },
      { question: 'Can I return or cancel an order?', answer: 'A return or cancellation policy has not been added to the current application yet.' },
    ],
  },
  {
    label: 'Selling Art',
    faqs: [
      { question: 'How can I sell my artwork on Showpeice?', answer: 'Choose Start selling to set up an artist account, then use the artist dashboard to manage your artwork.' },
      { question: 'How do I upload an artwork?', answer: 'In the artist dashboard, choose Add Artwork, enter its details, and upload a PNG, JPEG, or WebP image. You can save a draft or publish it.' },
      { question: 'How do payments work for artists?', answer: 'Artist payment processing and payouts are not connected in the current application. No payout method or schedule is provided.' },
    ],
  },
]

export function FAQTabsCard({ tabs = defaultTabs, onFooterClick }: FAQTabsCardProps) {
  const id = useId()
  const [activeTab, setActiveTab] = useState(0)
  const [openFAQ, setOpenFAQ] = useState<number | null>(0)
  const [supportNotice, setSupportNotice] = useState('')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const questionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const reducedMotion = useReducedMotion()
  const selectedTab = tabs[activeTab] ?? tabs[0]

  const tabKey = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const tabId = (index: number) => `${id}-tab-${tabKey(tabs[index].label)}`
  const panelId = (index: number) => `${id}-panel-${tabKey(tabs[index].label)}`
  const questionId = (tabIndex: number, questionIndex: number) => `${id}-question-${tabIndex}-${questionIndex}`
  const answerId = (tabIndex: number, questionIndex: number) => `${id}-answer-${tabIndex}-${questionIndex}`

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    setActiveTab(nextIndex)
    setOpenFAQ(0)
    tabRefs.current[nextIndex]?.focus()
  }

  const handleQuestionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | undefined
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % selectedTab.faqs.length
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + selectedTab.faqs.length) % selectedTab.faqs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = selectedTab.faqs.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    questionRefs.current[nextIndex]?.focus()
  }

  const contactSupport = () => {
    if (onFooterClick) {
      onFooterClick()
      return
    }
    setSupportNotice('Support contact is not configured in this version of Showpeice yet.')
  }

  return <div className="faq-tabs-card">
    <div className="faq-tab-list" role="tablist" aria-label="Frequently asked questions categories">
      {tabs.map((tab, index) => <button
        key={tab.label}
        ref={(element) => { tabRefs.current[index] = element }}
        className={`faq-tab${activeTab === index ? ' is-active' : ''}`}
        type="button"
        role="tab"
        id={tabId(index)}
        aria-selected={activeTab === index}
        aria-controls={panelId(index)}
        tabIndex={activeTab === index ? 0 : -1}
        onClick={() => {
          if (activeTab === index) return
          setActiveTab(index)
          setOpenFAQ(0)
        }}
        onKeyDown={(event) => handleTabKeyDown(event, index)}
      >{tab.label}</button>)}
    </div>

    <AnimatePresence mode="wait" initial={false}>
      {selectedTab && <motion.div
        key={selectedTab.label}
        className="faq-tab-panel"
        id={panelId(activeTab)}
        role="tabpanel"
        aria-labelledby={tabId(activeTab)}
        initial={reducedMotion ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? undefined : { opacity: 0, y: -3 }}
        transition={{ duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}
      >
        <div className="faq-accordion">
          {selectedTab.faqs.map((faq, index) => {
            const expanded = openFAQ === index
            const triggerId = questionId(activeTab, index)
            const contentId = answerId(activeTab, index)
            return <article className={`faq-item${expanded ? ' is-open' : ''}`} key={faq.question}>
              <h3 className="faq-question-heading">
                <button
                  ref={(element) => { questionRefs.current[index] = element }}
                  className="faq-question"
                  type="button"
                  id={triggerId}
                  aria-expanded={expanded}
                  aria-controls={contentId}
                  onClick={() => setOpenFAQ(expanded ? null : index)}
                  onKeyDown={(event) => handleQuestionKeyDown(event, index)}
                >
                  <span>{faq.question}</span>
                  <motion.span className="faq-chevron" aria-hidden="true" animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}><ChevronDown size={18}/></motion.span>
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {expanded && <motion.div
                  className="faq-answer-panel"
                  id={contentId}
                  role="region"
                  aria-labelledby={triggerId}
                  initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.24, ease: 'easeInOut' }}
                ><p>{faq.answer}</p></motion.div>}
              </AnimatePresence>
            </article>
          })}
        </div>
      </motion.div>}
    </AnimatePresence>

    <button className="faq-contact-button" type="button" onClick={contactSupport}>Contact Support</button>
    {supportNotice && <p className="faq-support-notice" role="status">{supportNotice}</p>}
  </div>
}
