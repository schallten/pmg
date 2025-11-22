/**
 * Media Viewer Component
 * Handles display of images, videos, and audio files
 */

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'ogg', 'mov', 'avi'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];

export function isMediaFile(filename) {
    const ext = getExtension(filename);
    return IMAGE_EXTENSIONS.includes(ext) ||
        VIDEO_EXTENSIONS.includes(ext) ||
        AUDIO_EXTENSIONS.includes(ext);
}

export function getMediaType(filename) {
    const ext = getExtension(filename);
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    return null;
}

export function displayMedia(path, filename) {
    const mediaPreview = document.getElementById('media-preview');
    const editorWrapper = document.querySelector('.editor-wrapper');
    const lineNumbers = document.getElementById('line-numbers');

    if (!mediaPreview) return false;

    const mediaType = getMediaType(filename);
    if (!mediaType) return false;

    // Hide editor, show media preview
    editorWrapper.style.display = 'none';
    lineNumbers.style.display = 'none';
    mediaPreview.style.display = 'flex';

    // Create appropriate media element
    const encodedPath = encodeURIComponent(path);
    const src = `/file?path=${encodedPath}&raw=true`;

    let mediaElement;
    if (mediaType === 'image') {
        mediaElement = `<img src="${src}" alt="${filename}">`;
    } else if (mediaType === 'video') {
        mediaElement = `<video controls src="${src}"></video>`;
    } else if (mediaType === 'audio') {
        mediaElement = `
            <div class="audio-player">
                <p>${filename}</p>
                <audio controls src="${src}"></audio>
            </div>
        `;
    }

    mediaPreview.innerHTML = mediaElement;
    return true;
}

export function hideMedia() {
    const mediaPreview = document.getElementById('media-preview');
    const editorWrapper = document.querySelector('.editor-wrapper');
    const lineNumbers = document.getElementById('line-numbers');

    if (mediaPreview) {
        mediaPreview.style.display = 'none';
        mediaPreview.innerHTML = '';
    }
    if (editorWrapper) editorWrapper.style.display = 'block';
    if (lineNumbers) lineNumbers.style.display = 'block';
}

function getExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}
