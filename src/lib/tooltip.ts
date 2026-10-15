// Hover tooltip helpers. The tooltip is an absolutely positioned <div>
// inside the map shell; D3 event handlers call these directly.

export function showTooltip(
	tooltip: HTMLElement,
	container: HTMLElement,
	event: MouseEvent,
	html: string
) {
	const bounds = container.getBoundingClientRect();
	const left = event.clientX - bounds.left + 14;
	const top = event.clientY - bounds.top + 14;
	tooltip.innerHTML = html;
	tooltip.style.transform = `translate(${left}px, ${top}px)`;
	tooltip.style.opacity = "1";
}

export function hideTooltip(tooltip: HTMLElement | null) {
	if (tooltip) tooltip.style.opacity = "0";
}
