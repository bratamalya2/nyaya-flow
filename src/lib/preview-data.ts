// One fictional dataset shared by every roadmap preview so identifiers agree across screens.
// No real party, judge, firm, bank account, or reported judgment appears here. "SYN" marks a
// synthetic law-report citation.
export const previewFirm = { name: "Iyer & Rao Chambers (demo)", city: "New Delhi" };

export const previewPeople = {
  lead: { name: "Adv. Meera Iyer", role: "Managing Partner", initials: "MI" },
  associate: { name: "Adv. Karan Rao", role: "Associate · drafting lead", initials: "KR" },
  advocate: { name: "Adv. Farah Siddiqui", role: "Advocate", initials: "FS" },
  paralegal: { name: "Ritu Nair", role: "Paralegal", initials: "RN" },
};

export const previewMatter = {
  title: "Asha Textiles Pvt. Ltd. v. Union of India & Anr.",
  shortTitle: "Asha Textiles v. Union of India",
  reference: "W.P.(C) 4417/2026",
  cnr: "DLHC010044172026",
  forum: "Delhi High Court",
  court: "Court 12",
  item: 14,
  nextListing: "Wed, 28 Oct 2026",
  client: "Asha Textiles Pvt. Ltd.",
  stage: "Rejoinder on merits",
};

export const previewCriminalMatter = {
  title: "Kabir Malhotra v. State (NCT of Delhi)",
  reference: "SLP(Crl.) 5120/2026",
  forum: "Supreme Court of India",
};

export const inr = (value: number) => `₹${new Intl.NumberFormat("en-IN").format(value)}`;
