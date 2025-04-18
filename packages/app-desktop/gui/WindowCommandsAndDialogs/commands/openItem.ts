import CommandService, { CommandRuntime, CommandDeclaration, CommandContext } from '@joplin/lib/services/CommandService';
import shim from '@joplin/lib/shim';
import { _ } from '@joplin/lib/locale';
import bridge from '../../../services/bridge';
import { openItemById } from '../../NoteEditor/utils/contextMenu';
import { fileUrlToResourceUrl, parseResourceUrl, urlProtocol } from '@joplin/lib/urlUtils';
import { fileUriToPath } from '@joplin/utils/url';
import { urlDecode } from '@joplin/lib/string-utils';
import Setting from '@joplin/lib/models/Setting';

export const declaration: CommandDeclaration = {
	name: 'openItem',
};

// Rich Markdown plugin prepends http:// before intra-note link (without note ID) when it's called via plugin's "Perform Action"
// keyboard shortcut or if it's clicked with CTRL key pressed (core functionality).
// Ideally would need to be fixed in plugin. Reference issue: https://github.com/CalebJohn/joplin-rich-markdown/issues/37
const INTRA_NOTE_LINK_AS_EXT_LINK_REGEX = /^http:\/\/#.*$/;

export const runtime = (): CommandRuntime => {
	return {
		execute: async (context: CommandContext, link: string) => {
			if (!link) throw new Error('Link cannot be empty');

			const fromFileUrl = fileUrlToResourceUrl(link, Setting.value('resourceDir'));
			if (fromFileUrl) {
				link = fromFileUrl;
			}

			const isIntraNoteLinkWithoutNoteIdButWithHash = INTRA_NOTE_LINK_AS_EXT_LINK_REGEX.test(link)
			if (link.startsWith('joplin://') || link.startsWith(':/') || isIntraNoteLinkWithoutNoteIdButWithHash) {
				const parsedUrl = parseResourceUrl(link);
				const intraNoteLinkHash = isIntraNoteLinkWithoutNoteIdButWithHash ? link.split("#")[1] : null;
				if (parsedUrl || intraNoteLinkHash) {
					const currentNoteId = context.state.selectedNoteIds[0];
					let { itemId, hash } = (parsedUrl != null) ? parsedUrl : { itemId: null, hash: null};
					hash = (intraNoteLinkHash == null) ? hash : intraNoteLinkHash;

					if (currentNoteId === itemId || isIntraNoteLinkWithoutNoteIdButWithHash) {
						await CommandService.instance().execute('scrollToHash', hash);
					} else {
						await openItemById(itemId, context.dispatch, hash);
					}
				} else {
					void bridge().openExternal(link);
				}
			} else if (urlProtocol(link)) {
				if (link.indexOf('file://') === 0) {
					// When using the file:// protocol, openPath doesn't work (does
					// nothing) with URL-encoded paths.
					//
					// shell.openPath seems to work with file:// urls on Windows,
					// but doesn't on macOS, so we need to convert it to a path
					// before passing it to openPath.
					const decodedPath = fileUriToPath(urlDecode(link), shim.platformName());
					void bridge().openItem(decodedPath);
				} else {
					void bridge().openExternal(link);
				}
			} else {
				bridge().showErrorMessageBox(_('Unsupported link or message: %s', link));
			}
		},
	};
};
