import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import { StateField } from '@codemirror/state'

export type SupportedSpellLanguage = 'en-US' | 'sv-SE' | 'de-DE' | 'es-ES' | 'fr-FR'

export const SPELL_LANGUAGE_LABELS: Record<SupportedSpellLanguage, string> = {
  'en-US': 'English (US / UK)',
  'sv-SE': 'Svenska (Swedish)',
  'de-DE': 'Deutsch (German)',
  'es-ES': 'Español (Spanish)',
  'fr-FR': 'Français (French)'
}

const COMMON_ENGLISH = [
  'a', 'about', 'above', 'accept', 'across', 'action', 'actions', 'active', 'actual', 'add', 'added', 'additional',
  'advisor', 'after', 'again', 'against', 'ai', 'all', 'allow', 'allows', 'almost', 'along', 'already', 'also',
  'although', 'always', 'am', 'among', 'amount', 'an', 'analysis', 'and', 'another', 'answer', 'any', 'anyone',
  'anything', 'app', 'appear', 'application', 'apply', 'approach', 'architecture', 'are', 'area', 'areas',
  'around', 'arrow', 'arrows', 'article', 'as', 'ask', 'asset', 'assets', 'assistant', 'at', 'attachment',
  'attachments', 'author', 'auto', 'automatic', 'automatically', 'available', 'away', 'back', 'background',
  'backlink', 'backlinks', 'backup', 'badge', 'bar', 'base', 'based', 'basic', 'be', 'because', 'become',
  'been', 'before', 'begin', 'behind', 'being', 'below', 'best', 'beta', 'better', 'between', 'beyond',
  'bidirectional', 'big', 'bilingual', 'binary', 'block', 'blocks', 'blockquote', 'blue', 'board', 'body',
  'bold', 'book', 'boolean', 'border', 'both', 'bottom', 'box', 'branch', 'branches', 'break', 'bridge',
  'bring', 'browser', 'buffer', 'build', 'builder', 'building', 'built', 'bullet', 'button', 'buttons', 'by',
  'byte', 'bytes', 'cache', 'calculate', 'calculation', 'call', 'called', 'callout', 'callouts', 'camera',
  'can', 'cancel', 'cannot', 'canvas', 'capabilities', 'capability', 'caption', 'card', 'cards', 'care',
  'carefully', 'case', 'cases', 'category', 'cause', 'caution', 'cell', 'cells', 'center', 'central',
  'certain', 'change', 'changed', 'changes', 'changing', 'channel', 'character', 'characters', 'chart',
  'chat', 'check', 'checkbox', 'checked', 'checklist', 'checks', 'choice', 'choose', 'circle', 'citation',
  'citations', 'class', 'classes', 'clean', 'clear', 'click', 'clicked', 'clicking', 'client', 'clipboard',
  'clone', 'close', 'closed', 'closing', 'cloud', 'code', 'codebase', 'coded', 'codemirror', 'coding',
  'coherent', 'collapse', 'collapsed', 'collapsible', 'color', 'colors', 'column', 'columns', 'combination',
  'combine', 'combines', 'come', 'command', 'commands', 'comment', 'comments', 'commit', 'commits', 'common',
  'communicate', 'communication', 'community', 'compact', 'company', 'compare', 'comparison', 'compatible',
  'complete', 'completed', 'completely', 'complex', 'complexity', 'component', 'components', 'comprehensive',
  'computer', 'concept', 'concern', 'concise', 'concurrent', 'condition', 'conditions', 'config',
  'configurable', 'configuration', 'configure', 'confirm', 'confirmation', 'confirmed', 'conflict',
  'conflicted', 'conflicts', 'connect', 'connected', 'connection', 'consider', 'consistent', 'console',
  'constant', 'constraint', 'constraints', 'contain', 'container', 'contains', 'content', 'contents',
  'context', 'continue', 'contrast', 'control', 'controls', 'convention', 'conventions', 'convert', 'copied',
  'copy', 'core', 'corner', 'corners', 'correct', 'correction', 'corrections', 'corresponding', 'corrupted',
  'cost', 'could', 'count', 'country', 'couple', 'course', 'cover', 'crash', 'create', 'created', 'creating',
  'creation', 'credential', 'credentials', 'criteria', 'critical', 'cross', 'css', 'ctrl', 'current',
  'currently', 'cursor', 'custom', 'customizable', 'customization', 'customize', 'cylinder', 'daily',
  'danger', 'dark', 'data', 'database', 'date', 'day', 'days', 'dead', 'deal', 'debounce', 'debounced',
  'debug', 'decide', 'decision', 'decisions', 'decoration', 'decorations', 'default', 'defaults', 'defense',
  'define', 'defined', 'defines', 'definition', 'degree', 'delay', 'delete', 'deleted', 'delimited',
  'delivery', 'demo', 'department', 'depend', 'dependencies', 'dependency', 'dependent', 'depth', 'describe',
  'described', 'description', 'design', 'designed', 'desktop', 'despite', 'destroy', 'detail', 'detailed',
  'details', 'detect', 'detected', 'detection', 'deterministic', 'develop', 'developer', 'development',
  'device', 'devices', 'diagnostic', 'diagnostics', 'diagram', 'diagrams', 'dialog', 'diamond', 'dictionary',
  'did', 'diff', 'difference', 'different', 'difficult', 'dimension', 'dimensions', 'dir', 'direct',
  'direction', 'directly', 'directories', 'directory', 'dirty', 'disable', 'disabled', 'discard', 'discover',
  'discovery', 'discuss', 'discussion', 'disk', 'dismiss', 'dispatch', 'display', 'displayed', 'displaying',
  'distance', 'distinction', 'divider', 'do', 'doc', 'docs', 'document', 'documentation', 'documented',
  'documents', 'does', 'doing', 'dom', 'domain', 'done', 'door', 'double', 'down', 'download', 'draft',
  'drafting', 'drag', 'draggable', 'dragging', 'draw', 'drawing', 'drawings', 'drawn', 'drive', 'drop',
  'dropdown', 'du', 'duplicate', 'during', 'dynamic', 'each', 'early', 'easier', 'easily', 'east', 'easy',
  'edge', 'edges', 'edit', 'editable', 'edited', 'editing', 'edition', 'editor', 'edits', 'education',
  'effect', 'effective', 'effects', 'efficiency', 'efficient', 'effort', 'eight', 'either', 'electron',
  'element', 'elements', 'ellipse', 'else', 'email', 'embed', 'embedded', 'embedding', 'empty', 'enable',
  'enabled', 'enables', 'encode', 'encoded', 'encoding', 'encounter', 'encrypted', 'encryption', 'end',
  'ending', 'endpoint', 'ends', 'energy', 'enforce', 'engine', 'engineered', 'engineering', 'english',
  'enhancement', 'enhancements', 'enjoy', 'enough', 'ensure', 'ensures', 'enter', 'entire', 'entity',
  'entries', 'entry', 'env', 'environment', 'environments', 'equal', 'equation', 'equations', 'error',
  'errors', 'escape', 'especially', 'essential', 'establish', 'established', 'etc', 'evaluate', 'evaluated',
  'even', 'evening', 'event', 'events', 'eventually', 'ever', 'every', 'everyone', 'everything', 'evidence',
  'exact', 'exactly', 'example', 'examples', 'excalidraw', 'except', 'exchange', 'exclude', 'exclusive',
  'execute', 'execution', 'executive', 'exist', 'existing', 'exists', 'exit', 'expand', 'expanded', 'expect',
  'expected', 'experience', 'experiment', 'explain', 'explanation', 'explicit', 'explicitly', 'explore',
  'explorer', 'export', 'exported', 'exporting', 'expose', 'expression', 'expressions', 'extend', 'extended',
  'extension', 'extensions', 'extensive', 'external', 'externally', 'extra', 'extract', 'extracted', 'eye',
  'face', 'fact', 'factor', 'fail', 'failed', 'failure', 'fall', 'fallback', 'false', 'family', 'far', 'fast',
  'faster', 'father', 'feature', 'featured', 'features', 'feedback', 'feel', 'feeling', 'feet', 'fence',
  'fenced', 'fetch', 'few', 'field', 'fields', 'fig', 'figure', 'file', 'filename', 'files', 'filesystem',
  'fill', 'filter', 'filtered', 'final', 'finally', 'find', 'finding', 'findings', 'fine', 'finish',
  'finished', 'fire', 'first', 'fit', 'five', 'fix', 'fixed', 'flag', 'flat', 'flatten', 'flex', 'flexible',
  'float', 'floating', 'flow', 'flowchart', 'focus', 'focused', 'folder', 'folders', 'follow', 'following',
  'font', 'fonts', 'footer', 'footnote', 'footnotes', 'for', 'force', 'foreign', 'forever', 'forget', 'form',
  'format', 'formatted', 'formatting', 'forms', 'formula', 'forth', 'forward', 'found', 'four', 'frame',
  'frameless', 'framework', 'free', 'freehand', 'french', 'frequent', 'fresh', 'friend', 'friendly', 'from',
  'front', 'frontmatter', 'full', 'fully', 'function', 'functional', 'functionality', 'functions', 'further',
  'future', 'game', 'gamma', 'gap', 'gate', 'gates', 'general', 'generate', 'generated', 'generates',
  'generating', 'generation', 'generator', 'generic', 'german', 'get', 'gets', 'getting', 'gfm', 'git',
  'github', 'give', 'given', 'gives', 'glass', 'glob', 'global', 'go', 'goal', 'goes', 'going', 'good', 'got',
  'government', 'graceful', 'gracefully', 'grained', 'grammar', 'granular', 'graph', 'graphics', 'gray',
  'great', 'green', 'grid', 'ground', 'group', 'groups', 'grow', 'growth', 'guarantee', 'guard', 'guess',
  'guide', 'guidelines', 'gutter', 'gutters', 'had', 'hair', 'half', 'hand', 'handed', 'handle', 'handled',
  'handler', 'handlers', 'handles', 'handling', 'happen', 'happened', 'happens', 'happy', 'hard', 'hardware',
  'has', 'hash', 'have', 'having', 'head', 'header', 'headers', 'heading', 'headings', 'headline',
  'headlines', 'headless', 'health', 'hear', 'heard', 'heart', 'heat', 'heavy', 'height', 'held', 'hello',
  'help', 'helper', 'helpful', 'helps', 'here', 'hidden', 'hide', 'hiding', 'hierarchy', 'high', 'higher',
  'highest', 'highlight', 'highlighted', 'highlighter', 'highlighting', 'highlights', 'highly', 'him',
  'himself', 'his', 'history', 'hit', 'hits', 'hold', 'holder', 'home', 'hook', 'hooks', 'hope',
  'horizontal', 'host', 'hot', 'hour', 'hours', 'house', 'how', 'however', 'html', 'http', 'https', 'huge',
  'human', 'hundred', 'hunk', 'hunks', 'i', 'icon', 'icons', 'id', 'idea', 'ideas', 'identifies', 'identify',
  'identity', 'ids', 'if', 'ignore', 'ignored', 'ignoring', 'image', 'images', 'imagine', 'immediate',
  'immediately', 'impact', 'implement', 'implementation', 'implemented', 'implementing', 'important',
  'import', 'imports', 'improve', 'improved', 'improvement', 'improvements', 'in', 'include', 'included',
  'includes', 'including', 'incoming', 'increase', 'increased', 'independent', 'independently', 'index',
  'indexed', 'indicate', 'indicates', 'indicator', 'individual', 'industry', 'inference', 'infinite', 'info',
  'information', 'initial', 'initialize', 'initialized', 'initiate', 'init', 'inline', 'inner', 'input',
  'inputs', 'insert', 'inserted', 'inserts', 'inside', 'inspect', 'install', 'installable', 'installation',
  'instance', 'instances', 'instant', 'instantly', 'instead', 'instruction', 'instructions', 'insufficient',
  'integer', 'integrate', 'integrated', 'integration', 'integrations', 'integrity', 'intend', 'intended',
  'intent', 'interact', 'interacted', 'interaction', 'interactive', 'interest', 'interface', 'interfaces',
  'intermediate', 'internal', 'internals', 'internet', 'interoperability', 'interval', 'interview', 'into',
  'introduce', 'introduced', 'invalid', 'invent', 'invisible', 'invocation', 'invoke', 'invoked', 'involve',
  'ipc', 'is', 'isolated', 'isolation', 'issue', 'issues', 'it', 'italic', 'item', 'items', 'iteration',
  'its', 'itself', 'javascript', 'jet', 'job', 'jobs', 'join', 'journey', 'journeys', 'json', 'jump', 'just',
  'katex', 'keep', 'keeping', 'keeps', 'key', 'keyboard', 'keybinding', 'keybindings', 'keychain', 'keymap',
  'keys', 'keyword', 'keywords', 'kill', 'kind', 'klartext', 'knew', 'know', 'knowledge', 'known', 'label',
  'labeled', 'labels', 'lack', 'land', 'language', 'languages', 'large', 'larger', 'last', 'late', 'later',
  'latest', 'latex', 'launch', 'launched', 'launching', 'law', 'layer', 'layout', 'lead', 'leading', 'learn',
  'least', 'leave', 'left', 'leg', 'length', 'lens', 'less', 'let', 'letter', 'letters', 'level', 'levels',
  'levenshtein', 'libraries', 'library', 'life', 'lifecycle', 'light', 'lightweight', 'like', 'likely',
  'limit', 'limited', 'line', 'linebreak', 'lines', 'link', 'linked', 'linking', 'links', 'lint', 'linting',
  'linux', 'list', 'listed', 'listen', 'listener', 'lists', 'literal', 'little', 'live', 'living', 'load',
  'loaded', 'loading', 'local', 'localhost', 'locally', 'locate', 'located', 'location', 'locations', 'lock',
  'log', 'logged', 'logic', 'login', 'logs', 'long', 'longer', 'look', 'looking', 'lookup', 'lookups', 'loop',
  'loopback', 'lose', 'loss', 'lost', 'lot', 'love', 'low', 'lower', 'lowercase', 'mac', 'machine', 'macos',
  'made', 'main', 'maintain', 'maintenance', 'major', 'make', 'makes', 'making', 'manage', 'managed',
  'management', 'manager', 'manifest', 'manifests', 'manual', 'manually', 'many', 'map', 'mapped', 'mapping',
  'margin', 'mark', 'markdown', 'marker', 'markers', 'marketplace', 'marks', 'match', 'matched', 'matches',
  'matching', 'material', 'math', 'mathematical', 'matrix', 'matter', 'max', 'maximize', 'maximum', 'may',
  'maybe', 'me', 'mean', 'meaning', 'means', 'measure', 'mechanism', 'mechanisms', 'media', 'medical', 'meet',
  'meeting', 'member', 'members', 'memory', 'mention', 'menu', 'menus', 'merge', 'mermaid', 'message',
  'messages', 'messaging', 'meta', 'metadata', 'method', 'methods', 'middle', 'might', 'migrate', 'migrated',
  'migration', 'military', 'million', 'min', 'mind', 'minimal', 'minimize', 'minimum', 'minute', 'minutes',
  'mirror', 'missing', 'misspelled', 'mistake', 'mobile', 'mock', 'mockup', 'mod', 'modal', 'modals', 'mode',
  'model', 'models', 'modern', 'modes', 'modification', 'modifications', 'modified', 'modify', 'modifying',
  'module', 'modules', 'moment', 'money', 'monitor', 'monitoring', 'mono', 'monospace', 'month', 'months',
  'moon', 'more', 'morning', 'most', 'mother', 'motion', 'mount', 'mounted', 'mouse', 'move', 'moved',
  'movement', 'moving', 'much', 'multi', 'multiple', 'music', 'must', 'my', 'myself', 'name', 'named',
  'names', 'namespace', 'narrow', 'nation', 'national', 'native', 'natural', 'nature', 'navigate',
  'navigated', 'navigation', 'navigator', 'near', 'nearly', 'necessary', 'need', 'needed', 'needs',
  'negative', 'neither', 'nest', 'nested', 'nesting', 'network', 'neutral', 'never', 'new', 'newly', 'news',
  'next', 'nice', 'night', 'nine', 'no', 'node', 'nodes', 'non', 'none', 'nor', 'nordic', 'normal',
  'normalize', 'normalized', 'north', 'not', 'note', 'notes', 'nothing', 'notice', 'notification',
  'notifications', 'notify', 'noun', 'now', 'null', 'number', 'numbered', 'numbers', 'numeric', 'object',
  'objects', 'observe', 'obvious', 'occur', 'occurrence', 'occurrences', 'occurred', 'of', 'off', 'offer',
  'office', 'official', 'offline', 'offset', 'often', 'oh', 'oil', 'ok', 'old', 'ollama', 'omit', 'omitted',
  'on', 'once', 'one', 'ones', 'ongoing', 'online', 'only', 'onto', 'open', 'openai', 'opened', 'opening',
  'opens', 'operate', 'operating', 'operation', 'operations', 'operator', 'opinion', 'opportunity', 'option',
  'optional', 'optionally', 'options', 'or', 'orchestrator', 'order', 'ordinary', 'organization', 'origin',
  'original', 'os', 'other', 'others', 'otherwise', 'our', 'out', 'outline', 'output', 'outside', 'over',
  'overall', 'overhaul', 'overlay', 'overlays', 'override', 'overrides', 'overwhelming', 'own', 'owner',
  'package', 'packaging', 'pad', 'padding', 'page', 'pages', 'paging', 'paint', 'pair', 'palette', 'pan',
  'panel', 'panels', 'paper', 'paragraph', 'paragraphs', 'parallel', 'parameter', 'parameters', 'parent',
  'parse', 'parsed', 'parser', 'parsing', 'part', 'partial', 'particular', 'particularly', 'parts', 'party',
  'pass', 'passed', 'passing', 'password', 'past', 'paste', 'pasted', 'pat', 'patch', 'path', 'paths',
  'pattern', 'patterns', 'pause', 'pay', 'payload', 'pdf', 'peer', 'pending', 'people', 'per', 'percent',
  'percentage', 'perfect', 'perform', 'performance', 'performed', 'performing', 'performs', 'perhaps',
  'period', 'permission', 'permissions', 'persist', 'persisted', 'persistent', 'persisting', 'persists',
  'person', 'personal', 'perspective', 'perspectives', 'phase', 'phone', 'phonetic', 'photo', 'phrase',
  'physical', 'pick', 'picker', 'pickers', 'picture', 'piece', 'pill', 'pin', 'pinned', 'pipeline', 'place',
  'placeholder', 'plan', 'planner', 'planning', 'plans', 'plant', 'platform', 'platforms', 'play',
  'playwright', 'please', 'plugin', 'plugins', 'plus', 'png', 'point', 'pointer', 'points', 'policy',
  'polish', 'polished', 'poll', 'polling', 'poor', 'pop', 'popular', 'port', 'portable', 'ports', 'pos',
  'position', 'positive', 'possible', 'possibly', 'post', 'potential', 'power', 'powerful', 'practice',
  'preceding', 'precise', 'precisely', 'predictable', 'prefer', 'preference', 'preferences', 'prefix',
  'preload', 'prepare', 'preserves', 'preserving', 'press', 'pressing', 'pressure', 'pretty', 'prevent',
  'previous', 'previously', 'price', 'primary', 'principle', 'principles', 'print', 'prioritize', 'priority',
  'private', 'privilege', 'privileges', 'probably', 'problem', 'problems', 'procedure', 'proceed', 'process',
  'processed', 'processes', 'processing', 'processor', 'produce', 'product', 'production', 'professional',
  'profile', 'program', 'programming', 'programs', 'progress', 'progression', 'progressive', 'project',
  'projects', 'promise', 'prompt', 'prompts', 'proper', 'properly', 'properties', 'property', 'ukar',
  'propose', 'proposed', 'proprietary', 'prosemirror', 'protect', 'protocol', 'protocols', 'prove', 'provide',
  'provided', 'provider', 'provides', 'providing', 'public', 'publishing', 'pull', 'pure', 'purpose',
  'purposes', 'push', 'pushed', 'put', 'px', 'python', 'quality', 'query', 'question', 'questions', 'queue',
  'queued', 'quick', 'quickly', 'quiet', 'quit', 'quite', 'quote', 'quoted', 'quotes', 'race', 'radio', 'rag',
  'raise', 'ram', 'random', 'range', 'ranges', 'rate', 'rather', 'ratio', 'raw', 're', 'reach', 'react',
  'reactive', 'read', 'ability', 'readability', 'readable', 'reader', 'reading', 'reads', 'ready', 'real',
  'reality', 'realize', 'really', 'reason', 'reasoning', 'reasons', 'rebase', 'receive', 'received',
  'receiving', 'recent', 'recently', 'recipient', 'recognize', 'recommend', 'recommendation',
  'recommendations', 'recommended', 'record', 'records', 'recover', 'recovery', 'rectangle', 'rectangles',
  'recurring', 'red', 'reduce', 'ref', 'refactor', 'reference', 'referenced', 'references', 'referencing',
  'refine', 'refining', 'reflect', 'refresh', 'refuse', 'regard', 'regardless', 'regex', 'region', 'register',
  'registered', 'registry', 'regular', 'rehype', 'reject', 'relate', 'related', 'relating', 'relationship',
  'relationships', 'relative', 'release', 'relevant', 'reliable', 'rely', 'remain', 'remaining', 'remains',
  'remark', 'remember', 'remind', 'reminder', 'reminders', 'remote', 'removal', 'remove', 'removed',
  'removing', 'rename', 'renamed', 'renames', 'renaming', 'render', 'rendered', 'renderer', 'rendering',
  'renders', 'reopen', 'replace', 'replaced', 'replacement', 'replacements', 'replacing', 'repo', 'report',
  'reported', 'reports', 'repositories', 'repository', 'repos', 'represent', 'representing', 'represents',
  'request', 'requested', 'requests', 'require', 'required', 'requirement', 'requirements', 'requires',
  'requiring', 'research', 'researcher', 'reset', 'residual', 'resizable', 'resize', 'resizer', 'resizing',
  'resolution', 'resolve', 'resolved', 'resolver', 'resolving', 'resource', 'resources', 'respect',
  'respective', 'respond', 'responds', 'response', 'responses', 'responsibility', 'responsive', 'rest',
  'restate', 'restore', 'restored', 'restrict', 'result', 'resulting', 'results', 'resume', 'resumes',
  'retrieval', 'retrieve', 'return', 'returned', 'returns', 'reuse', 'reveal', 'reveals', 'review',
  'rewrite', 'rewrites', 'rewriting', 'rich', 'right', 'rightclicking', 'rigorous', 'ring', 'rise', 'risk',
  'road', 'roadmap', 'role', 'roles', 'room', 'root', 'roots', 'rough', 'round', 'rounded', 'route', 'row',
  'rows', 'rule', 'rules', 'run', 'running', 'runs', 'runtime', 'safe', 'safestorage', 'safety', 'said',
  'same', 'sample', 'sandbox', 'sanitization', 'sanitize', 'sanitized', 'save', 'saved', 'saves', 'saving',
  'say', 'saying', 'says', 'scale', 'scan', 'scenario', 'scenarios', 'scene', 'scenes', 'schedule', 'schema',
  'schemas', 'scheme', 'schemes', 'science', 'scope', 'scoped', 'score', 'scratch', 'screen', 'script',
  'scripts', 'scroll', 'scroller', 'scrolling', 'sdk', 'seamless', 'seamlessly', 'search', 'searching',
  'season', 'seat', 'second', 'secondary', 'seconds', 'secret', 'section', 'sections', 'secure', 'security',
  'see', 'seeing', 'Cook', 'seek', 'seem', 'seems', 'seen', 'segment', 'segments', 'select', 'selectable',
  'selected', 'selecting', 'selection', 'selections', 'selector', 'self', 'semantic', 'semantics', 'send',
  'sender', 'sending', 'sends', 'sense', 'sensitive', 'sent', 'sentence', 'sentences', 'separate',
  'separated', 'separator', 'sequence', 'sequentially', 'serializable', 'serialization', 'serialize',
  'serialized', 'series', 'serious', 'serve', 'server', 'servers', 'service', 'services', 'session',
  'sessions', 'set', 'sets', 'setting', 'settings', 'setup', 'seven', 'several', 'shadow', 'shake', 'shall',
  'shape', 'shapes', 'share', 'shared', 'sharing', 'she', 'sheet', 'shell', 'shift', 'shiki', 'shoot',
  'short', 'shortcut', 'shortcuts', 'shot', 'should', 'shoulder', 'show', 'showed', 'showing', 'shown',
  'shows', 'side', 'sidebar', 'sidebars', 'sidecar', 'sidecars', 'sided', 'sides', 'sign', 'signal',
  'significant', 'silent', 'silently', 'similar', 'simple', 'simply', 'simultaneously', 'since', 'single',
  'sit', 'site', 'sitemap', 'situation', 'six', 'size', 'sized', 'sizes', 'sketch', 'sketches', 'skill',
  'skills', 'skip', 'skipping', 'slash', 'sleep', 'slice', 'slide', 'slides', 'slightly', 'slow', 'slug',
  'small', 'smaller', 'smart', 'smooth', 'smoothly', 'snapshot', 'snapshots', 'snippet', 'snippets', 'so',
  'social', 'software', 'solid', 'solution', 'solutions', 'solve', 'solved', 'some', 'somebody', 'someone',
  'something', 'sometimes', 'somewhat', 'somewhere', 'son', 'Validate', 'song', 'soon', 'sort', 'sound',
  'source', 'sources', 'south', 'space', 'spaces', 'span', 'spanish', 'sparkle', 'sparkles', 'spawn',
  'spawned', 'speak', 'special', 'specialized', 'specific', 'specifically', 'specification', 'specifications',
  'specified', 'specifies', 'specify', 'specifying', 'speed', 'spell', 'spellcheck', 'spellchecker',
  'spelling', 'spend', 'spike', 'split', 'spot', 'spreadsheet', 'spring', 'square', 'squiggly', 'src',
  'stable', 'stack', 'stage', 'staged', 'stand', 'standalone', 'standard', 'standing', 'star', 'start',
  'started', 'starter', 'starting', 'starts', 'state', 'stated', 'statement', 'states', 'static', 'station',
  'stat', 'stats', 'status', 'statuses', 'stay', 'stays', 'step', 'steps', 'still', 'stock', 'stone', 'stop',
  'stopped', 'stopping', 'storage', 'store', 'stored', 'stores', 'stories', 'story', 'straight', 'strategic',
  'strategies', 'strategy', 'stream', 'streaming', 'street', 'strength', 'strict', 'strictly', 'strike',
  'strikethrough', 'string', 'strings', 'strip', 'stripped', 'stroke', 'strong', 'struck', 'structural',
  'structure', 'structured', 'structures', 'studio', 'study', 'stuff', 'style', 'styled', 'styles', 'styling',
  'sub', 'subagent', 'subagents', 'submenu', 'submit', 'subscribe', 'subsequent', 'subset', 'substring',
  'subtle', 'succeed', 'success', 'successful', 'such', 'suddenly', 'suffer', 'suffix', 'suggest',
  'suggested', 'suggestion', 'suggestions', 'suggests', 'Disconnect', 'suit', 'suitable', 'suite', 'suited',
  'sum', 'summarize', 'summary', 'summer', 'sun', 'super', 'support', 'supported', 'supporting', 'supports',
  'suppose', 'sure', 'surface', 'surround', 'surrounded', 'surrounding', 'survey', 'sv', 'svg', 'swedish',
  'switch', 'switcher', 'switching', 'symbol', 'symbols', 'sync', 'synced', 'synchronization', 'synchronize',
  'synchronized', 'synchronously', 'syntax', 'system', 'systems', 'tab', 'table', 'tables', 'tablet',
  'tablets', 'tabs', 'tag', 'tags', 'tailwind', 'take', 'taken', 'takes', 'taking', 'talk', 'target',
  'targeted', 'targeting', 'targets', 'task', 'tasks', 'tax', 'teach', 'teacher', 'team', 'teamwork',
  'technical', 'technique', 'techniques', 'technology', 'tell', 'template', 'templates', 'temporary', 'ten',
  'tend', 'term', 'terminal', 'terminals', 'terminate', 'termination', 'terms', 'test', 'tested', 'testid',
  'testing', 'tests', 'text', 'textarea', 'texts', 'than', 'thank', 'thanks', 'that', 'the', 'their', 'them',
  'theme', 'themes', 'themselves', 'then', 'theory', 'there', 'therefore', 'these', 'they', 'thin', 'thing',
  'things', 'think', 'thinking', 'third', 'this', 'thorough', 'those', 'though', 'thought', 'thousand',
  'thread', 'three', 'through', 'throughout', 'throw', 'thus', 'ticket', 'tie', 'tight', 'time', 'timeline',
  'timelines', 'timeout', 'timer', 'timers', 'times', 'timestamp', 'timestamps', 'tiny', 'tip', 'tips',
  'title', 'titlebar', 'titles', 'to', 'today', 'together', 'toggle', 'toggleable', 'toggles', 'toggling',
  'token', 'tokens', 'told', 'tone', 'too', 'took', 'tool', 'toolbar', 'tooling', 'tools', 'tooltip',
  'tooltips', 'top', 'topic', 'total', 'touch', 'toward', 'towards', 'town', 'track', 'tracking', 'trade',
  'trademark', 'traditional', 'traffic', 'trajectory', 'transaction', 'transactions', 'transcript',
  'transcripts', 'transfer', 'transform', 'transformation', 'transformations', 'transition', 'transitions',
  'translate', 'translation', 'transparent', 'traversal', 'tree', 'trees', 'trial', 'trigger', 'triggered',
  'triggers', 'trim', 'trimmed', 'trivial', 'trouble', 'true', 'truncated', 'truncation', 'trust', 'truth',
  'try', 'trying', 'tsv', 'tunnel', 'tunnels', 'turn', 'turned', 'turning', 'turns', 'twelve', 'twenty',
  'twice', 'two', 'type', 'typecheck', 'typed', 'types', 'typescript', 'typewriter', 'typical', 'typing',
  'typography', 'ui', 'ultimate', 'unable', 'uncheck', 'unconditional', 'unconditionally', 'under',
  'underline', 'underlined', 'underlines', 'underlying', 'underspecified', 'understand', 'understanding',
  'undo', 'unexpected', 'unified', 'unique', 'uniquely', 'unit', 'united', 'universal', 'unknown', 'unless',
  'unlike', 'unlimited', 'unlock', 'unnecessary', 'unresolved', 'unsafe', 'unsaved', 'unspecified', 'until',
  'untitled', 'untrusted', 'up', 'update', 'updated', 'updates', 'updating', 'upgrade', 'upload', 'upon',
  'upper', 'uppercase', 'uri', 'url', 'urls', 'us', 'usage', 'use', 'used', 'useful', 'user', 'userdata',
  'users', 'uses', 'using', 'usual', 'usually', 'utilities', 'utility', 'utf', 'v', 'valid', 'validate',
  'validated', 'validation', 'value', 'values', 'var', 'variable', 'variables', 'variety', 'various',
  'vector', 'ver', 'verification', 'verified', 'verify', 'version', 'versioned', 'versions', 'versus',
  'vertical', 'very', 'via', 'video', 'view', 'viewbox', 'viewer', 'viewing', 'views', 'violation',
  'virtual', 'visibility', 'visible', 'vision', 'visit', 'visual', 'visualize', 'vite', 'voice', 'volume',
  'vs', 'vulnerability', 'wait', 'waiting', 'waits', 'wakeup', 'walk', 'walker', 'walkthrough',
  'walkthroughs', 'wall', 'want', 'wanted', 'wants', 'war', 'warm', 'warn', 'warning', 'warnings', 'was',
  'watch', 'watcher', 'watchers', 'watching', 'water', 'wavy', 'way', 'ways', 'we', 'weapon', 'wear', 'web',
  'website', 'week', 'weekly', 'weeks', 'weight', 'welcome', 'well', 'went', 'were', 'west', 'what',
  'whatever', 'when', 'whenever', 'where', 'whereas', 'whether', 'which', 'while', 'white', 'who', 'whole',
  'whom', 'whose', 'why', 'wide', 'wider', 'widget', 'widgets', 'width', 'widths', 'wife', 'wiki',
  'wikilink', 'wikilinks', 'will', 'win', 'wind', 'window', 'windows', 'wire', 'wish', 'with', 'within',
  'without', 'woman', 'women', 'wonder', 'word', 'words', 'wordwrap', 'work', 'worked', 'worker', 'workflow',
  'workflows', 'working', 'works', 'workspace', 'workspaces', 'world', 'worry', 'worse', 'worst', 'worth',
  'would', 'wrap', 'wrapped', 'wrapper', 'wrapping', 'write', 'writer', 'writes', 'writing', 'written',
  'wrong', 'wrote', 'x', 'xml', 'xss', 'y', 'yaml', 'yeah', 'year', 'years', 'yellow', 'yes', 'yesterday',
  'yet', 'you', 'young', 'your', 'yourself', 'z', 'zen', 'zero', 'zod', 'zone', 'zoom', 'zsh',
  'synonym', 'synonyms', 'explanations', 'aesthetic', 'distraction', 'emphasis', 'italicized',
  'nuance', 'deprecated', 'strikethroughs', 'monospaced', 'seamlessly', 'inactive', 'flavored',
  'architectural', 'accent', 'accents', 'summon', 'checklists', 'maintains', 'reloads', 'hardened',
  'boundary', 'previews', 'svgs', 'sanitized', 'dompurify', 'csp', 'policies', 'incoming',
  'subsystem', 'latency', 'passed', 'ripgrep', 'ndjson', 'completion', 'rfc', 'binding',
  'delimiters', 'inspector', 'reviewers', 'approved', 'fenced', 'badges', 'sql', 'bash',
  'indexer', 'scientific', 'notation', 'quantitative', 'latex', 'euler', 'equivalence',
  'gaussian', 'probability', 'density', 'softmax', 'maxwell', 'curl', 'vacuum', 'loopback',
  'inference', 'tailored', 'proposed', 'accepting', 'mounting', 'manifests', 'exclusively',
  'ollama', 'katex', 'mermaid', 'chokidar', 'rust', 'python'
]

const COMMON_SWEDISH = [
  'och', 'att', 'det', 'som', 'en', 'på', 'är', 'av', 'för', 'med', 'till', 'den', 'har', 'de', 'inte', 'om',
  'ett', 'han', 'men', 'var', 'jag', 'sig', 'från', 'vi', 'så', 'kan', 'man', 'när', 'år', 'säger', 'hon',
  'under', 'också', 'efter', 'eller', 'nu', 'sin', 'där', 'vid', 'mot', 'ska', 'skulle', 'kommer', 'ut',
  'får', 'finns', 'vara', 'hade', 'alla', 'andra', 'mycket', 'än', 'här', 'då', 'sedan', 'över', 'bara',
  'in', 'blir', 'upp', 'även', 'vad', 'få', 'två', 'vill', 'ha', 'många', 'hur', 'mer', 'går', 'sverige',
  'kronor', 'detta', 'nya', 'procent', 'skall', 'hans', 'utan', 'sina', 'något', 'allt', 'måste', 'redan',
  'blev', 'bli', 'dag', 'några', 'sitt', 'stora', 'varit', 'mellan', 'klartext', 'svenska', 'svensk',
  'rubrik', 'korrekt', 'sammansatt', 'användargränssnitt', 'dokument', 'redigera', 'text', 'kod', 'tabell',
  'diagram', 'bild', 'bilder', 'inställningar', 'sök', 'ersätt', 'spara', 'öppna', 'stäng', 'mapp', 'fil',
  'filer', 'vänster', 'höger', 'ljus', 'mörk', 'tema', 'lokal', 'synkronisering', 'konflikt', 'verktyg',
  'innehåll', 'översikt', 'länkar', 'stavning', 'stavningskontroll', 'språk', 'engelska', 'tyska', 'spanska',
  'franska', 'välkommen', 'anteckningar', 'projekt', 'arbetsyta', 'rubriker', 'typsnitt', 'storlek', 'färg',
  'svenskt', 'textprov', 'teknisk', 'sammanfattning', 'lokalt', 'dokumentverktyg', 'modernt', 'kombinerar',
  'blixtsnabb', 'redigering', 'versionshantering', 'språkmodellsanalys', 'molnberoende'
]

const COMMON_GERMAN = [
  'der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im',
  'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie',
  'nach', 'wird', 'bei', 'einer', 'um', 'am', 'sind', 'noch', 'wie', 'einem', 'über', 'einen', 'so', 'zum',
  'war', 'haben', 'nur', 'oder', 'aber', 'vor', 'zur', 'bis', 'mehr', 'durch', 'man', 'sein', 'wurde',
  'dokument', 'datei', 'ordner', 'suche', 'einstellungen', 'sprache', 'rechtschreibung', 'überschrift'
]

const COMMON_SPANISH = [
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'se', 'del', 'las', 'un', 'por', 'con', 'no', 'una', 'su',
  'para', 'es', 'al', 'lo', 'como', 'más', 'o', 'pero', 'sus', 'le', 'ha', 'me', 'si', 'sin', 'sobre',
  'este', 'ya', 'entre', 'cuando', 'todo', 'esta', 'ser', 'son', 'dos', 'también', 'fue', 'había', 'era',
  'documento', 'archivo', 'carpeta', 'buscar', 'configuración', 'idioma', 'ortografía', 'título', 'código'
]

const COMMON_FRENCH = [
  'de', 'la', 'le', 'et', 'les', 'des', 'en', 'un', 'du', 'une', 'que', 'est', 'pour', 'qui', 'dans', 'a',
  'par', 'plus', 'pas', 'au', 'sur', 'ne', 'se', 'lequel', 'ce', 'il', 'sont', 'avec', 'tout', 'faire',
  'son', 'mettre', 'autre', 'on', 'mais', 'nous', 'comme', 'ou', 'si', 'leur', 'elle', 'deux', 'même',
  'document', 'fichier', 'dossier', 'rechercher', 'paramètres', 'langue', 'orthographe', 'titre', 'code'
]

const DICTIONARIES: Record<SupportedSpellLanguage, Set<string>> = {
  'en-US': new Set(COMMON_ENGLISH.map((w) => w.trim().toLowerCase())),
  'sv-SE': new Set(COMMON_SWEDISH.map((w) => w.trim().toLowerCase())),
  'de-DE': new Set(COMMON_GERMAN.map((w) => w.trim().toLowerCase())),
  'es-ES': new Set(COMMON_SPANISH.map((w) => w.trim().toLowerCase())),
  'fr-FR': new Set(COMMON_FRENCH.map((w) => w.trim().toLowerCase()))
}

const KNOWN_TYPO_FIXES: Record<string, string[]> = {
  teh: ['the', 'ten', 'tea'],
  recieve: ['receive', 'relieve'],
  seperate: ['separate'],
  occured: ['occurred'],
  definately: ['definitely'],
  enviroment: ['environment'],
  wierd: ['weird', 'wired'],
  untill: ['until'],
  tommorow: ['tomorrow'],
  calender: ['calendar'],
  goverment: ['government'],
  adress: ['address', 'adress'],
  accomodate: ['accommodate'],
  wich: ['which', 'with', 'wish'],
  thier: ['their', 'there'],
  formating: ['formatting'],
  diffrent: ['different'],
  showened: ['showed', 'shown'],
  remova: ['remove', 'removal'],
  numers: ['numbers'],
  betewen: ['between'],
  corosponding: ['corresponding'],
  dosent: ['doesnt', 'does'],
  sepperator: ['separator'],
  suroundit: ['surround'],
  draging: ['dragging'],
  collapseble: ['collapsible'],
  nativ: ['native'],
  languges: ['languages'],
  configruble: ['configurable'],
  missspelled: ['misspelled'],
  swiggly: ['squiggly'],
  skigly: ['squiggly'],
  hidding: ['hiding'],
  deos: ['does'],
  chnage: ['change'],
  anvandargranssnitt: ['användargränssnitt'],
   stavningfel: ['stavningsfel', 'stavning'],
  dokumnet: ['dokument', 'document']
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  )
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost)
      }
    }
  }
  return dp[a.length][b.length]
}

export function isWordSpelledCorrectly(
  rawWord: string,
  languages: string[],
  customWords: string[] = []
): boolean {
  const clean = rawWord.replace(/^['’]+|['’]+$/g, '')
  if (clean.length <= 2) return true
  if (/\d/.test(clean)) return true
  // Ignore ALL-CAPS acronyms or camelCase/PascalCase code identifiers
  if (clean === clean.toUpperCase() && clean.length <= 6) return true
  if (/[a-z][A-Z]/.test(clean)) return true

  const lower = clean.toLowerCase()
  if (customWords.some((cw) => cw.toLowerCase() === lower)) return true

  // Check common English suffixes (s, es, ed, ing, ly, tion, er, est)
  const checkWithInflections = (dict: Set<string>, word: string): boolean => {
    if (dict.has(word)) return true
    if (word.endsWith('s') && dict.has(word.slice(0, -1))) return true
    if (word.endsWith('es') && dict.has(word.slice(0, -2))) return true
    if (word.endsWith('ed') && (dict.has(word.slice(0, -2)) || dict.has(word.slice(0, -1)))) return true
    if (word.endsWith('ing') && (dict.has(word.slice(0, -3)) || dict.has(`${word.slice(0, -3)}e`))) return true
    if (word.endsWith('ly') && dict.has(word.slice(0, -2))) return true
    // Swedish common inflections (-en, -et, -na, -ar, -er, -or, -ande, -ade)
    if (word.endsWith('en') && dict.has(word.slice(0, -2))) return true
    if (word.endsWith('et') && dict.has(word.slice(0, -2))) return true
    if (word.endsWith('na') && dict.has(word.slice(0, -2))) return true
    if (word.endsWith('ar') && dict.has(word.slice(0, -2))) return true
    if (word.endsWith('er') && dict.has(word.slice(0, -2))) return true
    return false
  }

  if (KNOWN_TYPO_FIXES[lower]) return false

  const activeLangs = languages.length > 0 ? languages : ['en-US', 'sv-SE']
  for (const lang of activeLangs) {
    const dict = DICTIONARIES[lang as SupportedSpellLanguage]
    if (dict && checkWithInflections(dict, lower)) {
      return true
    }
  }
  return false
}

export interface SpellSuggestionItem {
  word: string
  explanation: string
}

const WORD_EXPLANATIONS: Record<string, string> = {
  the: 'Definite article referring to a specific noun',
  ten: 'Cardinal number (10)',
  tea: 'Aromatic beverage prepared from cured leaves',
  receive: 'To be given, presented with, or paid something',
  relieve: 'To ease or alleviate pain, distress, or difficulty',
  separate: 'Forming or viewed as a unit apart or by itself',
  occurred: 'Happened; took place in the past',
  definitely: 'Without doubt; clearly and unambiguously',
  environment: 'The surroundings or conditions in which a system operates',
  weird: 'Strikingly odd or unusual in appearance or behavior',
  wired: 'Connected using electrical or network cables',
  until: 'Up to the point in time or the event mentioned',
  tomorrow: 'On the day after today',
  calendar: 'A chart or system showing days, weeks, and months',
  government: 'The governing body of a nation, state, or community',
  address: 'Location details or to speak/write to someone formally',
  accommodate: 'To provide space for or adapt to a requirement',
  which: 'Used to specify or ask about one or more items from a set',
  with: 'Accompanied by or possessing a feature',
  wish: 'A desire or hope for something to happen',
  their: 'Belonging to or associated with the people or things mentioned',
  there: 'In, at, or to that place or position',
  formatting: 'The way in which text, code, or data is arranged and styled',
  different: 'Not the same as another or each other; distinct',
  showed: 'Past tense of show; allowed or caused to be visible',
  shown: 'Past participle of show; demonstrated or displayed',
  remove: 'To take away or eliminate from a position',
  removal: 'The action of taking away or abolishing something',
  numbers: 'Arithmetical values representing quantities or counts',
  between: 'At, into, or across the space separating two objects',
  corresponding: 'Equivalent in character, form, or function',
  does: 'Third-person singular present of do; performs an action',
  separator: 'A line, character, or divider that separates items',
  surround: 'To be all around someone or something on every side',
  dragging: 'Pulling or moving an element across a screen while holding click',
  collapsible: 'Able to be folded or compacted into a smaller space',
  native: 'Built specifically for and integrated with the host OS',
  languages: 'Systems of human or computer communication',
  configurable: 'Capable of being customized or adjusted via settings',
  misspelled: 'Spelled incorrectly according to standard orthography',
  squiggly: 'Having a wavy, curling, or irregular line form',
  hiding: 'Concealing or keeping out of sight',
  change: 'To make or become different; modify or alter',
  användargränssnitt: 'Svenska: Gränssnitt mellan användare och datorprogram (UI)',
  stavningsfel: 'Svenska: Ord som har stavats felaktigt',
  stavning: 'Svenska: Sättet på vilket ett ord skrivs bokstav för bokstav',
  dokument: 'Svenska: Skriftlig eller digital fil med sammanhängande text',
  document: 'A written, printed, or electronic file that provides information',
  architecture: 'The conceptual structure and logical organization of a system',
  workspace: 'A working directory or collection of project folders',
  markdown: 'Lightweight markup language for creating formatted text'
}

const WORD_SYNONYMS: Record<string, SpellSuggestionItem[]> = {
  the: [
    { word: 'this', explanation: 'Refers to a specific thing close at hand' },
    { word: 'that', explanation: 'Refers to a specific thing previously mentioned' }
  ],
  receive: [
    { word: 'obtain', explanation: 'To acquire or secure something through effort' },
    { word: 'accept', explanation: 'To consent to receive or undertake something offered' }
  ],
  separate: [
    { word: 'distinct', explanation: 'Recognizably different in nature from something else' },
    { word: 'isolated', explanation: 'Kept apart from other modules or components' }
  ],
  occurred: [
    { word: 'happened', explanation: 'Took place; came about as an event' },
    { word: 'transpired', explanation: 'Came to be known or occurred in sequence' }
  ],
  definitely: [
    { word: 'certainly', explanation: 'Unquestionably; without any doubt' },
    { word: 'undoubtedly', explanation: 'Accepted as true beyond dispute' }
  ],
  environment: [
    { word: 'workspace', explanation: 'Dedicated working context or directory set' },
    { word: 'context', explanation: 'Surrounding state and runtime configuration' }
  ],
  different: [
    { word: 'distinct', explanation: 'Clearly separate and different in quality' },
    { word: 'alternative', explanation: 'Available as another possibility or choice' }
  ],
  remove: [
    { word: 'delete', explanation: 'To erase or remove permanently from storage' },
    { word: 'discard', explanation: 'To drop or get rid of as no longer useful' }
  ],
  change: [
    { word: 'modify', explanation: 'To make partial or minor changes to improve' },
    { word: 'update', explanation: 'To bring up to date with new settings or content' }
  ],
  misspelled: [
    { word: 'mistyped', explanation: 'Entered incorrectly on a keyboard' },
    { word: 'inaccurate', explanation: 'Not completely correct or exact' }
  ],
  formatting: [
    { word: 'styling', explanation: 'Visual presentation and typographic rules' },
    { word: 'layout', explanation: 'Spatial arrangement of text and UI elements' }
  ],
  document: [
    { word: 'file', explanation: 'A named collection of data stored on disk' },
    { word: 'note', explanation: 'A concise written record or Markdown entry' }
  ],
  dokument: [
    { word: 'anteckning', explanation: 'Svenska: Kortare nedskriven text eller notis' },
    { word: 'fil', explanation: 'Svenska: Lagrad dataenhet i filsystemet' }
  ],
  stavningsfel: [
    { word: 'skrivfel', explanation: 'Svenska: Misstag vid inmatning av text' },
    { word: 'tryckfel', explanation: 'Svenska: Oavsiktlig felstavning i text' }
  ]
}

export function describeSuggestedWord(word: string, languages: string[] = ['en-US']): string {
  const lower = word.toLowerCase()
  if (WORD_EXPLANATIONS[lower]) {
    return WORD_EXPLANATIONS[lower]
  }
  const isSwedish =
    DICTIONARIES['sv-SE'].has(lower) ||
    (languages.includes('sv-SE') && /[åäö]/i.test(lower))
  if (isSwedish) {
    return `Svenskt uppslagsord ("${word}") i ordlistan`
  }
  if (lower.endsWith('ing')) {
    return `Ongoing action or process form of "${lower.slice(0, -3)}"`
  }
  if (lower.endsWith('ed')) {
    return `Past-tense or completed state of "${lower.slice(0, -2)}"`
  }
  if (lower.endsWith('ly')) {
    return `Adverbial modifier describing how an action is performed`
  }
  return `Standard dictionary spelling for "${word}"`
}

export function getSpellingSuggestions(
  rawWord: string,
  languages: string[],
  maxSuggestions = 5
): string[] {
  const lower = rawWord.toLowerCase()
  const preserveCase = (candidate: string) => {
    if (rawWord[0] && rawWord[0] === rawWord[0].toUpperCase()) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1)
    }
    return candidate
  }

  if (KNOWN_TYPO_FIXES[lower]) {
    return KNOWN_TYPO_FIXES[lower].slice(0, maxSuggestions).map(preserveCase)
  }

  const activeLangs = languages.length > 0 ? languages : ['en-US', 'sv-SE']
  const candidates: Array<{ word: string; dist: number }> = []
  const seen = new Set<string>()

  for (const lang of activeLangs) {
    const dict = DICTIONARIES[lang as SupportedSpellLanguage]
    if (!dict) continue
    for (const entry of dict) {
      if (seen.has(entry)) continue
      if (Math.abs(entry.length - lower.length) > 2) continue
      const d = editDistance(lower, entry)
      if (d > 0 && d <= 2) {
        seen.add(entry)
        candidates.push({ word: entry, dist: d })
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist
    const sameFirst = (a.word[0] === lower[0] ? 0 : 1) - (b.word[0] === lower[0] ? 0 : 1)
    if (sameFirst !== 0) return sameFirst
    return a.word.length - b.word.length
  })

  return candidates.slice(0, maxSuggestions).map((c) => preserveCase(c.word))
}

export function getSpellingSuggestionsDetailed(
  rawWord: string,
  languages: string[],
  maxSuggestions = 5
): {
  suggestions: SpellSuggestionItem[]
  synonyms: SpellSuggestionItem[]
} {
  const words = getSpellingSuggestions(rawWord, languages, maxSuggestions)
  const suggestions: SpellSuggestionItem[] = words.map((w) => ({
    word: w,
    explanation: describeSuggestedWord(w, languages)
  }))

  const preserveCase = (candidate: string) => {
    if (rawWord[0] && rawWord[0] === rawWord[0].toUpperCase()) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1)
    }
    return candidate
  }

  const synonyms: SpellSuggestionItem[] = []
  const seenSyn = new Set<string>(words.map((w) => w.toLowerCase()))

  for (const w of words) {
    const key = w.toLowerCase()
    const list = WORD_SYNONYMS[key]
    if (list) {
      for (const item of list) {
        if (!seenSyn.has(item.word.toLowerCase())) {
          seenSyn.add(item.word.toLowerCase())
          synonyms.push({
            word: preserveCase(item.word),
            explanation: item.explanation
          })
        }
      }
    }
  }

  // Fallback contextual alternatives if no direct synonym map entry matched
  if (synonyms.length === 0 && words.length > 0) {
    const primary = words[0].toLowerCase()
    if (DICTIONARIES['sv-SE'].has(primary)) {
      synonyms.push(
        {
          word: preserveCase('alternativ'),
          explanation: 'Svenska: Annat möjligt ordval i sammanhanget'
        },
        {
          word: preserveCase('motsvarighet'),
          explanation: 'Svenska: Likvärdigt uttryck med samma betydelse'
        }
      )
    } else {
      synonyms.push(
        {
          word: preserveCase('equivalent'),
          explanation: 'Alternative term carrying the same contextual meaning'
        },
        {
          word: preserveCase('variant'),
          explanation: 'Related form or phrasing suitable for technical prose'
        }
      )
    }
  }

  return {
    suggestions,
    synonyms: synonyms.slice(0, 4)
  }
}

export interface SpellcheckExtensionOptions {
  enabled: boolean
  languages: string[]
  customWords: string[]
  ignoredOccurrences?: string[]
  onContextMenuMisspelledWord?: (info: {
    word: string
    from: number
    to: number
    clientX: number
    clientY: number
    suggestions: string[]
    detailedSuggestions: SpellSuggestionItem[]
    synonyms: SpellSuggestionItem[]
  }) => void
}

function buildSpellcheckDecorations(
  state: EditorView['state'],
  opts: SpellcheckExtensionOptions
): DecorationSet {
  if (!opts.enabled) return Decoration.none

  const ignoredSet = new Set(opts.ignoredOccurrences || [])
  const decos: Array<{ from: number; to: number; value: Decoration }> = []
  const doc = state.doc
  let inCodeFence = false
  let inFrontmatter = false

  for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
    const line = doc.line(lineNum)
    const text = line.text

    if (lineNum === 1 && text.trim() === '---') {
      inFrontmatter = true
      continue
    }
    if (inFrontmatter) {
      if (text.trim() === '---') inFrontmatter = false
      continue
    }

    if (/^\s*```/.test(text)) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue

    // Mask inline code, URLs, markdown links, math expressions so we only spellcheck prose words
    const masked = text
      .replace(/`[^`]*`/g, (m) => ' '.repeat(m.length))
      .replace(/\$[^$]*\$/g, (m) => ' '.repeat(m.length))
      .replace(/https?:\/\/[^\s)]+/g, (m) => ' '.repeat(m.length))
      .replace(/!\[[^\]]*\]\([^)]*\)/g, (m) => ' '.repeat(m.length))
      .replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_m, label, url) => `${label}${' '.repeat(url.length + 4)}`)

    const wordRegex = /[A-Za-zÅÄÖåäöÜüÖöÄäßÉéÈèÊêÁáÍíÓóÚúÑñ]{3,}/g
    let match: RegExpExecArray | null
    while ((match = wordRegex.exec(masked)) !== null) {
      const word = match[0]
      const from = line.from + match.index
      const to = from + word.length
      const occKey = `${from}:${to}:${word.toLowerCase()}`
      if (ignoredSet.has(occKey)) continue

      if (!isWordSpelledCorrectly(word, opts.languages, opts.customWords)) {
        decos.push({
          from,
          to,
          value: Decoration.mark({
            class: 'cm-spell-error',
            attributes: { 'data-misspelled': word }
          })
        })
      }
    }
  }

  return Decoration.set(decos, true)
}

export function createSpellcheckExtension(opts: SpellcheckExtensionOptions) {
  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildSpellcheckDecorations(state, opts)
    },
    update(deco, tr) {
      if (tr.docChanged) {
        return buildSpellcheckDecorations(tr.state, opts)
      }
      return deco
    },
    provide: (f) => EditorView.decorations.from(f)
  })

  const domHandlers = EditorView.domEventHandlers({
    contextmenu: (event, view) => {
      if (!opts.enabled || !opts.onContextMenuMisspelledWord) return false
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos === null) return false
      const line = view.state.doc.lineAt(pos)
      const offsetInLine = pos - line.from
      const wordRegex = /[A-Za-zÅÄÖåäöÜüÖöÄäßÉéÈèÊêÁáÍíÓóÚúÑñ]{3,}/g
      let m: RegExpExecArray | null
      while ((m = wordRegex.exec(line.text)) !== null) {
        const start = m.index
        const end = start + m[0].length
        if (offsetInLine >= start && offsetInLine <= end) {
          const word = m[0]
          const from = line.from + start
          const to = line.from + end
          const occKey = `${from}:${to}:${word.toLowerCase()}`
          if ((opts.ignoredOccurrences || []).includes(occKey)) {
            return false
          }
          if (!isWordSpelledCorrectly(word, opts.languages, opts.customWords)) {
            event.preventDefault()
            const detailed = getSpellingSuggestionsDetailed(word, opts.languages, 6)
            opts.onContextMenuMisspelledWord({
              word,
              from,
              to,
              clientX: event.clientX,
              clientY: event.clientY,
              suggestions: detailed.suggestions.map((s) => s.word),
              detailedSuggestions: detailed.suggestions,
              synonyms: detailed.synonyms
            })
            return true
          }
        }
      }
      return false
    }
  })

  return [field, domHandlers]
}

