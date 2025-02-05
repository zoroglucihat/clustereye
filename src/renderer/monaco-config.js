import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

// Monaco Editor'ü yapılandır
loader.config({ monaco });

// YAML dil desteğini ekle
monaco.languages.register({ id: 'yaml' });
monaco.languages.setMonarchTokensProvider('yaml', {
  tokenizer: {
    root: [
      [/^[\t ]*[A-Za-z_\-0-9]+(?=\:)/, 'type.identifier'],
      [/\:/, 'delimiter'],
      [/#.*$/, 'comment'],
      [/[0-9]+/, 'number'],
      [/[A-Za-z_\-0-9]+/, 'identifier'],
      [/".*?"/, 'string'],
      [/'.*?'/, 'string']
    ]
  }
});

export default monaco; 