import { describe, expect, test } from 'bun:test'
import {
  formatWebSearchToolResultContent,
  makeOutputFromSearchResponse,
} from './WebSearchTool.js'

describe('WebSearchTool result formatting', () => {
  test('does not expose internal reminder text', () => {
    const content = formatWebSearchToolResultContent({
      query: '上海今天天气',
      durationSeconds: 1,
      results: [
        {
          tool_use_id: 'srv-1',
          content: [
            {
              title: 'Shanghai Weather',
              url: 'https://example.com/weather',
            },
          ],
        },
      ],
    })

    expect(content).toContain('Search results for query: "上海今天天气"')
    expect(content).toContain('- [Shanghai Weather](https://example.com/weather)')
    expect(content).not.toContain('REMINDER:')
    expect(content).not.toContain('You MUST include')
  })

  test('drops pre-search assistant chatter from inner search call', () => {
    const output = makeOutputFromSearchResponse(
      [
        {
          type: 'text',
          text: '我将为您搜索上海今天的天气。',
        },
        {
          type: 'server_tool_use',
          id: 'srv-1',
          name: 'web_search',
          input: { query: '上海今天天气' },
        },
        {
          type: 'web_search_tool_result',
          tool_use_id: 'srv-1',
          content: [
            {
              title: 'Shanghai Weather',
              url: 'https://example.com/weather',
            },
          ],
        },
      ] as any,
      '上海今天天气',
      1,
    )

    expect(output.results).toEqual([
      {
        tool_use_id: 'srv-1',
        content: [
          {
            title: 'Shanghai Weather',
            url: 'https://example.com/weather',
          },
        ],
      },
    ])
  })

  test('drops retry chatter but keeps final factual summary', () => {
    const output = makeOutputFromSearchResponse(
      [
        {
          type: 'server_tool_use',
          id: 'srv-1',
          name: 'web_search',
          input: { query: '上海今天天气' },
        },
        {
          type: 'web_search_tool_result',
          tool_use_id: 'srv-1',
          content: [
            {
              title: 'Shanghai Weather',
              url: 'https://example.com/weather',
            },
          ],
        },
        {
          type: 'text',
          text: '搜索结果没有返回具体内容。让我尝试更通用的搜索。',
        },
        {
          type: 'server_tool_use',
          id: 'srv-2',
          name: 'web_search',
          input: { query: 'Shanghai weather today' },
        },
        {
          type: 'web_search_tool_result',
          tool_use_id: 'srv-2',
          content: [
            {
              title: 'Shanghai Forecast',
              url: 'https://example.com/forecast',
            },
          ],
        },
        {
          type: 'text',
          text: '上海今天多云，气温约 18 至 24 摄氏度。',
        },
      ] as any,
      '上海今天天气',
      1,
    )

    expect(output.results).toEqual([
      {
        tool_use_id: 'srv-1',
        content: [
          {
            title: 'Shanghai Weather',
            url: 'https://example.com/weather',
          },
        ],
      },
      {
        tool_use_id: 'srv-2',
        content: [
          {
            title: 'Shanghai Forecast',
            url: 'https://example.com/forecast',
          },
        ],
      },
      '上海今天多云，气温约 18 至 24 摄氏度。',
    ])
  })

  test('keeps native provider web search summary when no Anthropic search blocks are present', () => {
    const output = makeOutputFromSearchResponse(
      [
        {
          type: 'text',
          text: '上海今天多云，气温约 18 至 24 摄氏度。来源：https://example.com/weather',
        },
      ] as any,
      '上海今天天气',
      1,
    )

    expect(output.results).toEqual([
      '上海今天多云，气温约 18 至 24 摄氏度。来源：https://example.com/weather',
    ])
  })
})
