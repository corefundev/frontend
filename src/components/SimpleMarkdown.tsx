// src/components/SimpleMarkdown.tsx
//
// Minimal Markdown renderer for legal documents. No npm dep — supports
// the subset we need: headers (#/##/###), bullet lists (- ...), paragraphs,
// bold (**...**), italic (*...*). For richer needs, swap in `react-markdown`
// (5KB) — same component contract.

import React from 'react'

interface Props {
  text: string
  className?: string
}

function renderInline(line: string): React.ReactNode[] {
  // **bold** and *italic* — order matters: scan for ** first.
  const parts: React.ReactNode[] = []
  let i = 0
  let lastIdx = 0
  while (i < line.length) {
    if (line.slice(i, i + 2) === '**') {
      const end = line.indexOf('**', i + 2)
      if (end > i + 2) {
        if (i > lastIdx) parts.push(line.slice(lastIdx, i))
        parts.push(<strong key={i}>{line.slice(i + 2, end)}</strong>)
        i = end + 2
        lastIdx = i
        continue
      }
    }
    if (line[i] === '*' && line[i - 1] !== '*' && line[i + 1] !== '*') {
      const end = line.indexOf('*', i + 1)
      if (end > i + 1 && line[end + 1] !== '*') {
        if (i > lastIdx) parts.push(line.slice(lastIdx, i))
        parts.push(<em key={i}>{line.slice(i + 1, end)}</em>)
        i = end + 1
        lastIdx = i
        continue
      }
    }
    i++
  }
  if (lastIdx < line.length) parts.push(line.slice(lastIdx))
  return parts
}

export default function SimpleMarkdown({ text, className = '' }: Props) {
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []

  let listBuf: string[] = []
  const flushList = () => {
    if (!listBuf.length) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-6 space-y-1 my-3">
        {listBuf.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    )
    listBuf = []
  }

  let paraBuf: string[] = []
  const flushPara = () => {
    if (!paraBuf.length) return
    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed my-3">
        {renderInline(paraBuf.join(' '))}
      </p>,
    )
    paraBuf = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushList()
      continue
    }
    if (line.startsWith('### ')) {
      flushPara(); flushList()
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="text-lg font-semibold mt-5 mb-2">
          {renderInline(line.slice(4))}
        </h3>,
      )
      continue
    }
    if (line.startsWith('## ')) {
      flushPara(); flushList()
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="text-xl font-semibold mt-6 mb-3">
          {renderInline(line.slice(3))}
        </h2>,
      )
      continue
    }
    if (line.startsWith('# ')) {
      flushPara(); flushList()
      blocks.push(
        <h1 key={`h1-${blocks.length}`} className="text-3xl font-bold mt-2 mb-4">
          {renderInline(line.slice(2))}
        </h1>,
      )
      continue
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushPara()
      listBuf.push(line.slice(2))
      continue
    }
    flushList()
    paraBuf.push(line)
  }
  flushPara()
  flushList()

  return <div className={className}>{blocks}</div>
}
