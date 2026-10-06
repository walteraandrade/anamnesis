import { describe, expect, it } from 'vitest'
import {
  detectLang,
  findPlaceholders,
  parseFile,
  parseStoryFile,
  renderDraft,
  slugify,
  toPlainText,
} from '../lib/stories/parse'

describe('parseStoryFile', () => {
  it('takes the first heading as the question and the rest as the answer', () => {
    const entry = parseStoryFile(
      'answer-broke-in-production.md',
      '# Tell us about a time your code broke in production.\n\nIn July 2026 I found the bill had jumped.\n',
    )
    expect(entry).toMatchObject({
      kind: 'story',
      group: 'broke-in-production',
      lang: 'en',
      question: 'Tell us about a time your code broke in production.',
      answer: 'In July 2026 I found the bill had jumped.',
    })
  })

  it('groups language variants by file name', () => {
    const pt = parseStoryFile('answer-broke-in-production-ptbr.md', '# Conte sobre um bug\n\nEu não sabia.')
    expect(pt).toMatchObject({ group: 'broke-in-production', lang: 'pt' })
  })

  it('reads frontmatter aliases, lang and group, and heading alternatives', () => {
    const entry = parseStoryFile(
      'answer-x.md',
      '---\nlang: pt-br\ngroup: incident\naliases:\n  - Describe a production bug\n---\n# Main question | Other phrasing\n\nBody',
    )
    expect(entry).toMatchObject({
      lang: 'pt',
      group: 'incident',
      question: 'Main question',
      aliases: ['Other phrasing', 'Describe a production bug'],
      answer: 'Body',
    })
  })

  it('drops private notes after a horizontal rule', () => {
    const entry = parseStoryFile(
      'answer-fast.md',
      '# Q\n\nThe answer.\n\n---\n\n## Backup\n- other cases\n\n## Sources\n- a.md',
    )
    expect(entry.answer).toBe('The answer.')
  })

  it('falls back to the file name when there is no heading', () => {
    expect(parseStoryFile('answer-llm-experience.md', 'Just text').question).toBe('Llm experience')
  })
})

describe('parseFile', () => {
  it('splits facts files by second-level headings', () => {
    const entries = parseFile(
      'facts.md',
      '# Facts\n\n## Notice period | Aviso prévio\n2 weeks\n\n## LinkedIn\nhttps://linkedin.com/in/x\n\n## Empty\n',
    )
    expect(entries.map((e) => [e.kind, e.question, e.aliases, e.answer])).toEqual([
      ['fact', 'Notice period', ['Aviso prévio'], '2 weeks'],
      ['fact', 'LinkedIn', [], 'https://linkedin.com/in/x'],
    ])
  })

  it('ignores files that are not stories or facts', () => {
    expect(parseFile('email-clara.md', '# Hi')).toEqual([])
    expect(parseFile('smarthow-contribuicoes.md', '# Notes')).toEqual([])
  })
})

describe('detectLang', () => {
  it('tells Portuguese from English', () => {
    expect(detectLang('Eu não sabia que a integração ia quebrar, então fiz um rollback.')).toBe('pt')
    expect(detectLang('I found that the exporter was wired with no sampling.')).toBe('en')
  })

  it('ignores URLs and uses the fallback when there is no signal', () => {
    expect(detectLang('LinkedIn https://www.linkedin.com/in/x')).toBe('en')
    expect(detectLang('Pretensão salarial')).toBe('pt')
    expect(detectLang('LinkedIn', 'pt')).toBe('pt')
  })
})

describe('renderDraft', () => {
  it('writes frontmatter, heading and answer', () => {
    expect(
      renderDraft({ question: 'Why  us?\n', answer: 'Because.', lang: 'en', from: 'answer-a.md' }, '2026-10-05'),
    ).toBe('---\nlang: en\nsaved: 2026-10-05\nfrom: answer-a.md\n---\n\n# Why us?\n\nBecause.\n')
  })
})

describe('toPlainText', () => {
  it('removes markdown that would show up literally in a form', () => {
    expect(
      toPlainText('Every call is a `Deployment` row.\n\n- **Use as is:** bounded.\n- See [docs](https://x.dev).'),
    ).toBe('Every call is a Deployment row.\n\n- Use as is: bounded.\n- See docs (https://x.dev).')
  })

  it('keeps identifiers with single underscores and asterisks', () => {
    expect(toPlainText('Set OTEL_SAMPLING_RATIO and 2*3')).toBe('Set OTEL_SAMPLING_RATIO and 2*3')
  })
})

describe('findPlaceholders', () => {
  it('finds bracketed blanks to fill but not links', () => {
    expect(findPlaceholders('I push back. [One line on why this company.] See [docs](https://x).')).toEqual([
      '[One line on why this company.]',
    ])
  })
})

describe('slugify', () => {
  it('drops accents and symbols', () => {
    expect(slugify('Pretensão salarial (CLT)?')).toBe('pretensao-salarial-clt')
  })
})
