import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { artwork } from '../../data/artworks'
import { ProtectedArtworkImage } from '../../components/ProtectedArtworkImage'

type ArticleSection = {
  heading: string
  paragraphs: string[]
}

type JournalArticle = {
  slug: string
  category: string
  title: string
  description: string
  artworkId: number
  sections: ArticleSection[]
}

// Edit article copy here. Each image is linked to an artwork already in the marketplace.
const journalArticles: JournalArticle[] = [
  {
    slug: 'start-collecting-original-art',
    category: 'Collecting Guide',
    title: 'How to Start Collecting Original Art',
    description: 'A thoughtful first step into collecting: follow your curiosity, learn what matters to you, and make room for a piece you love.',
    artworkId: 1,
    sections: [
      {
        heading: 'Begin with what holds your attention',
        paragraphs: [
          'A collection does not need to begin with a plan. Notice the colours, materials, subjects, and moods you return to. The works that stay with you after you have looked away are a useful place to start.',
          'Spend time exploring different forms of art. A painting, photograph, print, or sculptural work can each bring a different kind of presence into a room.',
        ],
      },
      {
        heading: 'Make practical choices feel personal',
        paragraphs: [
          'Set a comfortable budget and consider where a work might live. Measure the wall or shelf, account for natural light, and check the listed dimensions and materials before deciding.',
          'Read the artwork details carefully and ask questions when something is unclear. A clear understanding of the medium, size, and presentation helps you choose with confidence.',
        ],
      },
      {
        heading: 'Collect at your own pace',
        paragraphs: [
          'There is no required number of works or timeline. Let your collection take shape around pieces that feel meaningful to you. A single original work can be a complete beginning.',
        ],
      },
    ],
  },
  {
    slug: 'story-behind-the-canvas',
    category: 'Art & Culture',
    title: 'The Story Behind the Canvas',
    description: 'Look closer at the choices, materials, and small discoveries that give a finished artwork its character.',
    artworkId: 3,
    sections: [
      {
        heading: 'A surface keeps its history',
        paragraphs: [
          'An artwork can hold traces of how it came together: a softened edge, a layer left visible, or a mark that changes the rhythm of the whole composition. Looking closely makes those decisions easier to see.',
          'Materials shape the experience too. The texture of paint, the grain of paper, or the contrast of graphite against a painted surface gives each work its own physical character.',
        ],
      },
      {
        heading: 'Notice the details',
        paragraphs: [
          'Try stepping back to take in the full composition, then moving closer to follow its smaller details. Consider where your eye rests and how the balance of colour, shape, and space guides it.',
          'There may not be one correct interpretation. Your response is part of the experience, and it can change as you spend more time with the work.',
        ],
      },
      {
        heading: 'Let curiosity lead',
        paragraphs: [
          'When a detail catches your attention, use it as an invitation to explore the materials and choices described alongside the artwork. The more you notice, the more room the work has to unfold.',
        ],
      },
    ],
  },
  {
    slug: 'choose-art-for-your-space',
    category: 'Collecting Guide',
    title: 'Choosing Art for Your Space',
    description: 'A few simple ways to think about scale, light, colour, and the feeling you want a room to hold.',
    artworkId: 5,
    sections: [
      {
        heading: 'Start with the room',
        paragraphs: [
          'Think about how a room is used and where your attention naturally falls. A work above a table may be seen from across the room, while something near a reading chair can invite a closer look.',
          'Use the artwork dimensions to picture its scale. You can mark the measurements on a wall with removable tape before making a decision.',
        ],
      },
      {
        heading: 'Work with light and colour',
        paragraphs: [
          'Daylight changes throughout the day, so notice how it moves across the space. Keep delicate materials away from direct sunlight, and consider how the artwork’s tones sit beside the room’s existing colours.',
          'A close colour match is not essential. Contrast can bring energy, while quieter tones can help a room feel settled. Choose the relationship that feels right to you.',
        ],
      },
      {
        heading: 'Choose what you want to live with',
        paragraphs: [
          'The best fit is not always the most coordinated one. Give yourself time to look, and choose a work that brings something you value into the space each time you encounter it.',
        ],
      },
    ],
  },
]

const photo = (id: string, width = 1000) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`

function getArticleArtwork(article: JournalArticle) {
  return artwork.find((item) => item.id === article.artworkId)
}

function ArticleCard({ article }: { article: JournalArticle }) {
  const image = getArticleArtwork(article)

  return <article className="journal-card">
    <Link className="journal-card-image" to={`/blog/${article.slug}`} aria-label={`Read ${article.title}`}>
      {image && <ProtectedArtworkImage isProtected={image.isProtected} src={photo(image.image, 900)} alt={`Artwork: ${image.title}`} loading="lazy"/>}
    </Link>
    <div className="journal-card-copy">
      <span className="journal-category">{article.category}</span>
      <h3><Link to={`/blog/${article.slug}`}>{article.title}</Link></h3>
      <p>{article.description}</p>
      <Link className="journal-read-link" to={`/blog/${article.slug}`}>Read article</Link>
    </div>
  </article>
}

export function JournalSection() {
  return <section className="journal-section section-wrap" id="journal" aria-labelledby="journal-heading">
    <header className="journal-heading">
      <div className="eyebrow"><span className="eyebrow-line"/> THE SHOWPEICE JOURNAL</div>
      <h2 id="journal-heading">Stories Behind the Art</h2>
    </header>
    <div className="journal-grid">
      {journalArticles.map((article) => <ArticleCard key={article.slug} article={article}/>) }
    </div>
    <div className="journal-all-link"><Link to="/blog">View all articles <ArrowRight size={15}/></Link></div>
  </section>
}

export function BlogIndexPage() {
  return <main className="blog-page section-wrap">
    <header className="blog-index-heading">
      <div className="eyebrow"><span className="eyebrow-line"/> NOTES, IDEAS & INSPIRATION</div>
      <h1 className="route-title">The Journal<em>.</em></h1>
      <p className="route-intro">Stories and guides for looking closer, collecting thoughtfully, and making room for art.</p>
    </header>
    <div className="journal-grid blog-index-grid">
      {journalArticles.map((article) => <ArticleCard key={article.slug} article={article}/>) }
    </div>
  </main>
}

export function BlogArticlePage() {
  const { slug = '' } = useParams()
  const article = journalArticles.find((item) => item.slug === slug)
  if (!article) {
    return <main className="blog-page section-wrap blog-missing">
      <div className="eyebrow"><span className="eyebrow-line"/> THE SHOWPEICE JOURNAL</div>
      <h1 className="route-title">This story is not here<em>.</em></h1>
      <Link className="journal-back-link" to="/blog"><ArrowLeft size={15}/> Back to all articles</Link>
    </main>
  }

  const image = getArticleArtwork(article)

  return <main className="blog-page section-wrap blog-article-page">
    <Link className="journal-back-link" to="/blog"><ArrowLeft size={15}/> All articles</Link>
    <article>
      <header className="blog-article-heading">
        <span className="journal-category">{article.category}</span>
        <h1>{article.title}</h1>
        <p>{article.description}</p>
      </header>
      {image && <figure className="blog-article-image"><ProtectedArtworkImage isProtected={image.isProtected} src={photo(image.image, 1500)} alt={`Artwork: ${image.title}`}/><figcaption>{image.title}</figcaption></figure>}
      <div className="blog-article-content">
        {article.sections.map((section) => <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>)}
      </div>
    </article>
    <footer className="blog-article-footer"><Link className="journal-back-link" to="/blog"><ArrowLeft size={15}/> Back to the journal</Link></footer>
  </main>
}
