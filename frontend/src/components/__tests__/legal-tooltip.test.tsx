import { render, screen } from "@testing-library/react";
import LegalTooltip from "../LegalTooltip";

describe("LegalTooltip", () => {
  it("renders the legal reference and summary for a known field", () => {
    render(<LegalTooltip field="procedure" />);

    expect(screen.getByRole("button", { name: /aide juridique/i })).toBeInTheDocument();
    expect(screen.getByText("Art. 19-20")).toBeInTheDocument();
    expect(screen.getByText(/mode de passation/i)).toBeInTheDocument();
  });

  it("renders nothing for an unknown field", () => {
    const { container } = render(<LegalTooltip field="unknown-field" />);

    expect(container).toBeEmptyDOMElement();
  });
});
