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
};
