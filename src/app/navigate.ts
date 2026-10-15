/** Hash routing: '/', '/basics', '/play/1'..'/play/4', '/lab'. */
export function navigate(to: string) {
  location.hash = to
}
