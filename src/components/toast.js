import toastr from 'toastr';

toastr.options = {
	closeButton: false,
	debug: false,
	newestOnTop: false,
	progressBar: false,
	positionClass: 'toast-bottom-right',
	preventDuplicates: false,
	onclick: null,
	showDuration: '300',
	hideDuration: '1000',
	timeOut: '5000',
	extendedTimeOut: '1000',
	showEasing: 'swing',
	hideEasing: 'linear',
	showMethod: 'fadeIn',
	hideMethod: 'fadeOut'
};

/**
 * Toasts a message to the user by displaying a popup.
 * @param title {string} - The title of the toast.
 * @param descr {string} - A description of the problem/update.
 * @param severity {string} - The severity of the toast, possible values are 'info', 'success', 'warning' and 'error'. Defaults to 'success'.
 */
export default function toast(title, descr = undefined, severity = 'success') {
	if (descr)
		toastr[severity](descr, title);
	else
		toastr[severity](title);
}