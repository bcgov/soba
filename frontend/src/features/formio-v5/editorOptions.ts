/** The part of a Quill Delta the clipboard matcher below uses. */
type QuillDelta = { slice(start: number, end: number): QuillDelta };

// Inline images are embedded as base64 in the submission, which Form.io can't hold at our sizing.
export const NO_INLINE_IMAGE_EDITORS = {
  ckeditor: {
    settings: {
      removePlugins: [
        'Image',
        'ImageCaption',
        'ImageResize',
        'ImageStyle',
        'ImageToolbar',
        'ImageUpload',
        'EasyImage',
        'CKFinder',
      ],
    },
  },
  // Form.io merges its own default toolbar over these settings, so the image button stays; it is
  // hidden in globals.css. These close the paths that insert an image.
  quill: {
    settings: {
      modules: {
        // Picked, pasted and dropped image files go through the uploader, which reads them as base64.
        uploader: { handler: () => {} },
        // Pasted HTML turns each <img> into an image embed.
        clipboard: { matchers: [['img', (_node: Node, delta: QuillDelta) => delta.slice(0, 0)]] },
      },
    },
  },
};
