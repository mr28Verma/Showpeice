import { useEffect, useId, useRef, useState } from 'react'
import { CloudUpload, FileText, ImageIcon, LoaderCircle, PencilLine, UserRound, X } from 'lucide-react'
import { toast } from '../../components/ui/toast'
import './ArtworkFileUpload.css'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  pdf: 'application/pdf',
}

type ArtworkFileUploadProps = {
  file: File | null
  onFileChange: (file: File | null) => void
  variant?: 'artwork' | 'banner' | 'avatar'
  existingImageUrl?: string | null
  disabled?: boolean
  uploading?: boolean
  error?: string
  uploadSuccess?: boolean
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExtension(file: File) {
  return file.name.split('.').pop()?.toLowerCase() ?? ''
}

function validateArtworkFile(file: File, variant: 'artwork' | 'banner' | 'avatar') {
  const extension = fileExtension(file)
  const expectedMime = MIME_BY_EXTENSION[extension]
  const mimeMatches = file.type === expectedMime || file.type === '' || file.type === 'application/octet-stream' ||
    (extension === 'jpg' && file.type === 'image/jpg')

  if (variant === 'banner' || variant === 'avatar') {
    if (!['png', 'jpg', 'jpeg'].includes(extension) || !mimeMatches) return 'Choose a PNG or JPEG image.'
    if (file.size === 0) return 'This file is empty. Choose an image with content.'
    if (file.size > MAX_FILE_BYTES) return 'Choose an image that is 10 MB or smaller.'
    return ''
  }

  if (!expectedMime || !mimeMatches) return 'Choose a PNG, JPG, JPEG, or PDF file.'
  if (file.size === 0) return 'This file is empty. Choose a file with content.'
  if (file.size > MAX_FILE_BYTES) return 'Choose a file that is 10 MB or smaller.'
  return ''
}

export function ArtworkFileUpload({
  file,
  onFileChange,
  variant = 'artwork',
  existingImageUrl = null,
  disabled = false,
  uploading = false,
  error = '',
  uploadSuccess = false,
}: ArtworkFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const helpId = useId()
  const [dragging, setDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const isBanner = variant === 'banner'
  const isAvatar = variant === 'avatar'
  const isImageUploader = isBanner || isAvatar
  const hasSavedBanner = isBanner && Boolean(existingImageUrl && existingImageUrl.trim())
  const hasSavedArtwork = !isImageUploader && Boolean(existingImageUrl && existingImageUrl.trim())
  const extension = file ? fileExtension(file) : ''
  const isImage = extension === 'png' || extension === 'jpg' || extension === 'jpeg'
  const effectivePreviewUrl = file && isImage ? previewUrl : ''
  const displayBannerSrc = isBanner ? (file ? effectivePreviewUrl : (existingImageUrl?.trim() ?? '')) : ''

  useEffect(() => {
    if (!file || !isImage) {
      return
    }
    let isMounted = true
    const reader = new FileReader()
    reader.onload = () => {
      if (isMounted) {
        setPreviewUrl(typeof reader.result === 'string' ? reader.result : '')
      }
    }
    reader.readAsDataURL(file)
    return () => {
      isMounted = false
    }
  }, [file, isImage])

  const acceptFiles = (files: FileList | null) => {
    if (disabled) return
    if (!files || files.length === 0) return
    if (files.length > 1) {
      toast.warning('Choose one file', 'Select one artwork file at a time.')
      return
    }
    if (file && !isImageUploader) {
      toast.warning('Remove the selected file first', 'Only one artwork file can be selected at a time.')
      return
    }

    const nextFile = files[0]
    const validationError = validateArtworkFile(nextFile, variant)
    if (validationError) {
      toast.warning('File not accepted', validationError)
      return
    }

    onFileChange(nextFile)
  }

  const removeFile = () => {
    if (disabled) return
    onFileChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const openFileDialog = () => {
    if (!disabled) inputRef.current?.click()
  }

  return (
    <section
      className={`artwork-file-upload${isBanner ? ' artwork-file-upload-banner' : ''}${isAvatar ? ' artwork-file-upload-avatar' : ''}${hasSavedBanner ? ' has-saved-banner' : ''}`}
      aria-labelledby={hasSavedBanner ? undefined : `${inputId}-title`}
      aria-label={hasSavedBanner ? 'Artist banner image' : undefined}
    >
      {!hasSavedBanner && (
        <header className="artwork-file-upload-header">
          <div>
            <h3 id={`${inputId}-title`}>{isBanner ? 'Upload banner image' : isAvatar ? 'Upload avatar' : 'Upload files'}</h3>
            <p id={helpId}>{isBanner ? 'PNG or JPEG up to 10 MB. A wide image around 3:1 works best.' : isAvatar ? 'PNG, JPG up to 10 MB.' : 'PNG, JPG or PDF up to 10 MB.'}</p>
          </div>
        </header>
      )}

      <input
        ref={inputRef}
        id={inputId}
        className="artwork-file-upload-input"
        type="file"
        accept={isImageUploader ? '.png,.jpg,.jpeg,image/png,image/jpeg' : '.png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf'}
        aria-describedby={helpId}
        tabIndex={-1}
        disabled={disabled}
        onChange={event => {
          acceptFiles(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
      />

      {/* Conditionally render drag-and-drop uploader only when no saved banner exists */}
      {!hasSavedBanner && (
        <div
          className={`artwork-file-dropzone${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
          role={isImageUploader ? 'button' : 'group'}
          aria-label={isBanner ? 'Upload banner image' : isAvatar ? 'Upload avatar' : 'File drop zone'}
          aria-describedby={helpId}
          tabIndex={isImageUploader && !disabled ? 0 : undefined}
          onClick={isImageUploader ? openFileDialog : undefined}
          onKeyDown={isImageUploader ? event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openFileDialog()
            }
          } : undefined}
          onDragOver={event => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
            if (!disabled) setDragging(true)
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={event => {
            event.preventDefault()
            setDragging(false)
            acceptFiles(event.dataTransfer.files)
          }}
        >
          {uploading ? (
            <LoaderCircle className="artwork-file-cloud-icon artwork-file-spinner" size={27} strokeWidth={1.8} aria-hidden="true" />
          ) : isAvatar ? (
            <span className="artwork-file-avatar-preview" aria-hidden="true">
              {file || existingImageUrl ? (
                <img src={file ? effectivePreviewUrl : existingImageUrl ?? ''} alt="" />
              ) : (
                <UserRound size={27} strokeWidth={1.7} />
              )}
            </span>
          ) : isBanner ? (
            <ImageIcon className="artwork-file-cloud-icon" size={27} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <CloudUpload className="artwork-file-cloud-icon" size={27} strokeWidth={1.8} aria-hidden="true" />
          )}
          {isBanner && !disabled && <strong className="artwork-file-banner-title">Upload banner image</strong>}
          {isAvatar && !disabled && <strong className="artwork-file-banner-title">{file ? 'Change image' : 'Upload avatar'}</strong>}
          <p>{uploading ? `Uploading ${isAvatar ? 'avatar' : 'banner'} image…` : disabled ? 'Saving profile changes…' : isBanner ? 'Drag and drop an image here or click to browse.' : isAvatar ? 'PNG, JPG up to 10 MB.' : <>
            Drag and drop, or{' '}
            <button
              type="button"
              className="artwork-file-browse"
              aria-label="Browse for a PNG, JPG, JPEG, or PDF file"
              disabled={disabled}
              onClick={() => {
                openFileDialog()
              }}
            >
              browse
            </button>
          </>}</p>
          {isImageUploader && !disabled && (
            <button
              type="button"
              className="artwork-file-select-button"
              onClick={event => {
                event.stopPropagation()
                openFileDialog()
              }}
            >
              {isAvatar && file ? 'Choose another' : 'Select image'}
            </button>
          )}
        </div>
      )}

      {/* Banner Display: when banner already exists, display ONLY the banner image */}
      {hasSavedBanner && (
        <div
          className={`artwork-file-banner-preview artwork-file-banner-interactive${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
          role="button"
          tabIndex={disabled ? undefined : 0}
          aria-label="Change banner image"
          title="Click to change banner image"
          onClick={disabled ? undefined : openFileDialog}
          onKeyDown={disabled ? undefined : event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openFileDialog()
            }
          }}
          onDragOver={event => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
            if (!disabled) setDragging(true)
          }}
          onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={event => {
            event.preventDefault()
            setDragging(false)
            acceptFiles(event.dataTransfer.files)
          }}
        >
          {displayBannerSrc && (
            <img
              src={displayBannerSrc}
              alt={file ? 'Selected banner preview' : 'Current banner'}
              onError={event => {
                event.currentTarget.style.display = 'none'
              }}
            />
          )}

          {!disabled && (
            <div className="artwork-file-banner-overlay" aria-hidden="true">
              <span className="artwork-file-banner-change-btn">
                <PencilLine size={14} strokeWidth={2} />
                <span>{dragging ? 'Drop new banner' : 'Change banner'}</span>
              </span>
            </div>
          )}

          {uploading && (
            <div className="artwork-file-banner-uploading-overlay">
              <LoaderCircle className="artwork-file-cloud-icon artwork-file-spinner" size={24} strokeWidth={2} aria-hidden="true" />
              <span>Uploading banner image…</span>
            </div>
          )}
        </div>
      )}

      {hasSavedArtwork && !file && (
        <div className="artwork-file-existing-preview">
          <img src={existingImageUrl ?? ''} alt="Current artwork preview" />
          <span>Current artwork preview</span>
        </div>
      )}

      {/* Fallback preview for unsaved banner upload when user originally had no banner */}
      {!hasSavedBanner && isBanner && (file || existingImageUrl) && (
        <div className="artwork-file-banner-preview">
          <img src={file ? effectivePreviewUrl : existingImageUrl ?? ''} alt={file ? 'Selected banner preview' : 'Current banner'} />
        </div>
      )}

      {/* Selection pill / revert action for replaced banner */}
      {hasSavedBanner && file && (
        <div className="artwork-file-banner-footer">
          <div className="artwork-file-details">
            <strong title={file.name}>{file.name}</strong>
            <span>{extension.toUpperCase()} &middot; {formatFileSize(file.size)} (ready to save)</span>
          </div>
          <button
            type="button"
            className="artwork-file-remove"
            onClick={removeFile}
            disabled={disabled}
            aria-label={`Remove ${file.name} and restore saved banner`}
            title="Restore saved banner"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Regular selection bar for artworks or first-time banner/avatar */}
      {!hasSavedBanner && file && (
        <div className="artwork-file-selection" aria-live="polite">
          <div className="artwork-file-preview" aria-hidden="true">
            {isImage ? <img src={effectivePreviewUrl} alt="Selected artwork preview"/> : <FileText size={20} strokeWidth={1.7} />}
          </div>
          <div className="artwork-file-details">
            <strong title={file.name}>{file.name}</strong>
            <span>{extension.toUpperCase()} &middot; {formatFileSize(file.size)}</span>
          </div>
          <button type="button" className="artwork-file-remove" onClick={removeFile} disabled={disabled} aria-label={`Remove ${file.name}`}>
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      {error && <p className="artwork-file-error" role="alert">{error}</p>}
      {isImageUploader && uploadSuccess && <p className="artwork-file-upload-success" role="status">{isAvatar ? 'Avatar' : 'Banner image'} uploaded and saved.</p>}
      {!isImageUploader && <p className="artwork-file-upload-note">Files stay on this device until server upload is connected.</p>}
    </section>
  )
}
