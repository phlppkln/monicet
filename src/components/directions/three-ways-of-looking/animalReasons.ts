// "Why I come to the Azores": background notes per species for The Animal.
//
// These are NOT derived from the MONICET archive. They summarise published
// field studies, so the UI labels them as background, separately from the
// charts. Only species with a note listed here get a card; the others show
// the data alone. Each claim should carry a source; entries whose `sources`
// list is empty still need one (ISSUES.md lists them).
//
// Keyed by scientific name, because common names come from a hand-written
// map in scripts/build-data.ts and could change.

export interface AnimalReason {
	/** Short answer in the animal's voice, e.g. "Refuelling stop". */
	title: string;
	text: string;
	sources: string[];
}

const BALEEN_SPRING_STOPOVER =
	"Visser, F., Hartman, K. L., Pierce, G. J., Valavanis, V. D. & Huisman, J. (2011). Timing of migratory baleen whales at the Azores in relation to the North Atlantic spring bloom. Marine Ecology Progress Series 440.";

const BLUE_FIN_FORAGING =
	"Silva, M. A., Prieto, R., Jonsen, I., Baumgartner, M. F. & Santos, R. S. (2013). North Atlantic blue and fin whales suspend their spring migration to forage in middle latitudes. PLoS ONE 8(10).";

export const ANIMAL_REASONS: Record<string, AnimalReason> = {
	"Balaenoptera musculus": {
		title: "Refuelling stop",
		text: "I pass through in spring on my way north and stop to eat during the spring plankton bloom. I breed somewhere else, in warmer water in winter.",
		sources: [BALEEN_SPRING_STOPOVER, BLUE_FIN_FORAGING],
	},
	"Balaenoptera physalus": {
		title: "Refuelling stop",
		text: "I pass through in spring on my way north and stop to eat during the spring plankton bloom. I breed somewhere else, in warmer water in winter.",
		sources: [BALEEN_SPRING_STOPOVER, BLUE_FIN_FORAGING],
	},
	"Balaenoptera borealis": {
		title: "Refuelling stop",
		text: "I migrate through the islands, a little later in spring than blue and fin whales, and feed on the way north.",
		sources: [BALEEN_SPRING_STOPOVER],
	},
	"Megaptera novaeangliae": {
		title: "Passing through",
		text: "I cross the Azores on my migration between warm breeding waters in the south and feeding grounds in the north.",
		sources: [BALEEN_SPRING_STOPOVER],
	},
	"Physeter macrocephalus": {
		title: "I live here",
		text: "Females and young live in family groups that stay around the islands all year and dive deep for squid. Adult males range much farther and come to visit.",
		sources: [],
	},
	"Stenella frontalis": {
		title: "Following warm water",
		text: "I arrive when the sea warms in early summer and leave again in autumn.",
		sources: [],
	},
	"Caretta caretta": {
		title: "Growing up",
		text: "I hatched on a beach on the other side of the Atlantic, and currents carried me here as a juvenile. I grow up in the open ocean; I don't breed here.",
		sources: [
			"Bolten, A. B., Bjorndal, K. A., Martins, H. R., Dellinger, T., Biscoito, M. J., Encalada, S. E. & Bowen, B. W. (1998). Transatlantic developmental migrations of loggerhead sea turtles demonstrated by mtDNA sequence analysis. Ecological Applications 8(1).",
		],
	},
};
