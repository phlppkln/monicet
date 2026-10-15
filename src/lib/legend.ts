import * as d3 from "d3";

// Horizontal gradient legend: a 260×52 SVG with a color bar and two or
// three tick labels underneath. Styled through the `.legend-label` class.
export function renderGradientLegend(
	container: HTMLElement,
	gradientId: string,
	colorForT: (t: number) => string,
	labels: { left: string; center?: string; right: string }
) {
	d3.select(container).selectAll("*").remove();

	const width = 260;
	const height = 52;

	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.attr("preserveAspectRatio", "xMinYMin meet")
		.style("width", "100%");

	const gradient = svg
		.append("defs")
		.append("linearGradient")
		.attr("id", gradientId)
		.attr("x1", "0%")
		.attr("x2", "100%")
		.attr("y1", "0%")
		.attr("y2", "0%");

	for (let i = 0; i <= 100; i += 4) {
		gradient
			.append("stop")
			.attr("offset", `${i}%`)
			.attr("stop-color", colorForT(i / 100));
	}

	svg.append("rect")
		.attr("x", 8)
		.attr("y", 8)
		.attr("width", width - 16)
		.attr("height", 14)
		.attr("rx", 4)
		.attr("fill", `url(#${gradientId})`)
		.attr("stroke", "#d5d5d5")
		.attr("stroke-width", 0.6);

	svg.append("text")
		.attr("x", 8)
		.attr("y", 40)
		.attr("class", "legend-label")
		.text(labels.left);

	if (labels.center !== undefined) {
		svg.append("text")
			.attr("x", width / 2)
			.attr("y", 40)
			.attr("class", "legend-label")
			.attr("text-anchor", "middle")
			.text(labels.center);
	}

	svg.append("text")
		.attr("x", width - 8)
		.attr("y", 40)
		.attr("class", "legend-label")
		.attr("text-anchor", "end")
		.text(labels.right);
}
