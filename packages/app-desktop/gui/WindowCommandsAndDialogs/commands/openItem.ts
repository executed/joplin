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

// Rich Markdown plugin prepends http:// before intra-note link when it's called via "Perform Action" keyboard shortcut.
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

			const isIntraNoteLinkAsExternalLink = INTRA_NOTE_LINK_AS_EXT_LINK_REGEX.test(link)
			if (link.startsWith('joplin://') || link.startsWith(':/') || isIntraNoteLinkAsExternalLink) {
				const parsedUrl = parseResourceUrl(link);
				const intraNoteLinkHash = isIntraNoteLinkAsExternalLink ? link.split("#")[1] : null;
				if (parsedUrl || intraNoteLinkHash) {
					const currentNoteId = context.state.selectedNoteIds[0];
					let { itemId, hash } = (parsedUrl != null) ? parsedUrl : { itemId: null, hash: null};
					hash = (intraNoteLinkHash == null) ? hash : intraNoteLinkHash;

					console.debug("Current noteId: " + currentNoteId);
					console.debug("Requested noteId: " + itemId);
					console.debug("Requested hash: " + hash);

					if (currentNoteId === itemId || isIntraNoteLinkAsExternalLink) {
						console.debug("Just scrolling to hash...");
						await CommandService.instance().execute('scrollToHash', hash);
					} else {
						console.debug("Opening hash in requested note...");
						await openItemById(itemId, context.dispatch, hash);
					}
					let skipSetCursorIfPresent = false;
					// For regular note openings or cross-note link without hash 'Resume Note' might restore scroll/cursor.
					// We don't want to overwrite it.
					if (hash?.length < 1) {
						skipSetCursorIfPresent = true;
					}
					setTimeout(() => {
						CommandService.instance().execute('editor.setCursorAtViewportBeginning', skipSetCursorIfPresent);
					}, 1000);

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
