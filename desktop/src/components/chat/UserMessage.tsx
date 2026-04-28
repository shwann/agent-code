import type { UIAttachment } from '../../types/chat'
import { AttachmentGallery } from './AttachmentGallery'
import { MessageActionBar } from './MessageActionBar'

type Props = {
  content: string
  attachments?: UIAttachment[]
  onRewind?: () => void
  rewindLabel?: string
}

export function UserMessage({ content, attachments, onRewind, rewindLabel }: Props) {
  const hasText = content.trim().length > 0

  return (
    <div className="group mb-5 flex justify-end">
      <div
        data-message-shell="user"
        className="flex min-w-0 w-full max-w-[82%] flex-col items-end gap-2 sm:max-w-[78%] lg:max-w-[70%]"
      >
        {attachments && attachments.length > 0 && (
          <AttachmentGallery attachments={attachments} variant="message" />
        )}

        {hasText && (
          <div
            className="border border-[var(--color-border)] bg-[var(--color-surface-user-msg)] px-4 py-3 text-sm leading-relaxed text-[var(--color-text-primary)] whitespace-pre-wrap break-words shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            style={{ borderRadius: '18px 8px 18px 18px' }}
          >
            {content}
          </div>
        )}

        {hasText && (
          <MessageActionBar
            copyText={content}
            copyLabel="Copy prompt"
            onRewind={onRewind}
            rewindLabel={rewindLabel}
            align="end"
          />
        )}
      </div>
    </div>
  )
}
