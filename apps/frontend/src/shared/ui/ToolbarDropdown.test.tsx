import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Type } from "lucide-react";
import { ToolbarDropdown } from "./ToolbarDropdown";

describe("ToolbarDropdown", () => {
  it("renders the trigger closed initially", () => {
    render(
      <ToolbarDropdown icon={Type} label="Текст">
        {() => <button>Жирный</button>}
      </ToolbarDropdown>
    );
    expect(screen.getByTitle("Текст")).toBeInTheDocument();
    expect(screen.queryByText("Жирный")).not.toBeInTheDocument();
  });

  it("opens on trigger click and shows children", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarDropdown icon={Type} label="Текст">
        {() => <button>Жирный</button>}
      </ToolbarDropdown>
    );
    await user.click(screen.getByTitle("Текст"));
    expect(screen.getByText("Жирный")).toBeInTheDocument();
  });

  it("toggles closed when the trigger is clicked again", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarDropdown icon={Type} label="Текст">
        {() => <button>Жирный</button>}
      </ToolbarDropdown>
    );
    const trigger = screen.getByTitle("Текст");
    await user.click(trigger);
    await user.click(trigger);
    expect(screen.queryByText("Жирный")).not.toBeInTheDocument();
  });

  it("closes when children call the provided close() callback", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarDropdown icon={Type} label="Текст">
        {(close) => <button onClick={close}>Жирный</button>}
      </ToolbarDropdown>
    );
    await user.click(screen.getByTitle("Текст"));
    await user.click(screen.getByText("Жирный"));
    expect(screen.queryByText("Жирный")).not.toBeInTheDocument();
  });

  it("closes on an outside click", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ToolbarDropdown icon={Type} label="Текст">
          {() => <button>Жирный</button>}
        </ToolbarDropdown>
        <button>Снаружи</button>
      </div>
    );
    await user.click(screen.getByTitle("Текст"));
    await user.click(screen.getByText("Снаружи"));
    expect(screen.queryByText("Жирный")).not.toBeInTheDocument();
  });

  it("does not close from a click inside the dropdown panel", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarDropdown icon={Type} label="Текст">
        {() => <span data-testid="inner">Жирный</span>}
      </ToolbarDropdown>
    );
    await user.click(screen.getByTitle("Текст"));
    await user.click(screen.getByTestId("inner"));
    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });

  it("applies active styling from the active prop while closed", () => {
    render(
      <ToolbarDropdown icon={Type} label="Текст" active>
        {() => <button>Жирный</button>}
      </ToolbarDropdown>
    );
    expect(screen.getByTitle("Текст")).toHaveClass("text-blue-600");
  });

  it("applies active styling while open regardless of the active prop", async () => {
    const user = userEvent.setup();
    render(
      <ToolbarDropdown icon={Type} label="Текст">
        {() => <button>Жирный</button>}
      </ToolbarDropdown>
    );
    const trigger = screen.getByTitle("Текст");
    expect(trigger).not.toHaveClass("text-blue-600");
    await user.click(trigger);
    expect(trigger).toHaveClass("text-blue-600");
  });
});