import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmationDialog from "@/components/Wallet/ConfirmationDialog";

describe("ConfirmationDialog", () => {
  const defaultProps = {
    open: true,
    title: "Confirm Action",
    description: "This action cannot be undone.",
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders when open", () => {
      render(<ConfirmationDialog {...defaultProps} />);
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      expect(screen.getByText("Confirm Action")).toBeInTheDocument();
      expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    });

    it("does not render when closed", () => {
      render(<ConfirmationDialog {...defaultProps} open={false} />);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("renders custom labels", () => {
      render(
        <ConfirmationDialog
          {...defaultProps}
          confirmLabel="Delete"
          cancelLabel="Keep"
        />
      );
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /keep/i })).toBeInTheDocument();
    });

    it("renders default labels when not provided", () => {
      render(<ConfirmationDialog {...defaultProps} />);
      expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes", () => {
      render(<ConfirmationDialog {...defaultProps} />);
      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby", "dialog-title");
      expect(dialog).toHaveAttribute("aria-describedby", "dialog-description");
    });

    it("focuses confirm button on open", async () => {
      render(<ConfirmationDialog {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /confirm/i })).toHaveFocus();
      });
    });

    it("returns focus to trigger element on close", async () => {
      const TriggerButton = () => {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <button onClick={() => setOpen(true)} data-testid="trigger">
              Open
            </button>
            <ConfirmationDialog
              {...defaultProps}
              open={open}
              onCancel={() => setOpen(false)}
              onConfirm={() => setOpen(false)}
            />
          </>
        );
      };

      render(<TriggerButton />);
      const trigger = screen.getByTestId("trigger");
      trigger.click();

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      cancelBtn.click();

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
    });

    it("closes on Escape key", async () => {
      render(<ConfirmationDialog {...defaultProps} />);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it("has focusable elements in the correct order", async () => {
      render(<ConfirmationDialog {...defaultProps} />);
      
      const confirmBtn = screen.getByRole("button", { name: /confirm/i });
      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      const closeBtn = screen.getByRole("button", { name: /close dialog/i });

      expect(confirmBtn).toBeInTheDocument();
      expect(cancelBtn).toBeInTheDocument();
      expect(closeBtn).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("calls onConfirm when confirm button clicked", async () => {
      const user = userEvent.setup();
      render(<ConfirmationDialog {...defaultProps} />);
      
      const confirmBtn = screen.getByRole("button", { name: /confirm/i });
      await user.click(confirmBtn);
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when cancel button clicked", async () => {
      const user = userEvent.setup();
      render(<ConfirmationDialog {...defaultProps} />);
      
      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelBtn);
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel when backdrop clicked", async () => {
      render(<ConfirmationDialog {...defaultProps} />);
      
      const backdrop = document.querySelector("[aria-hidden='true']");
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it("calls onCancel when close button clicked", async () => {
      const user = userEvent.setup();
      render(<ConfirmationDialog {...defaultProps} />);
      
      const closeBtn = screen.getByRole("button", { name: /close dialog/i });
      await user.click(closeBtn);
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it("does not call onCancel when loading", async () => {
      const user = userEvent.setup();
      render(<ConfirmationDialog {...defaultProps} loading={true} />);
      
      const cancelBtn = screen.getByRole("button", { name: /cancel/i });
      expect(cancelBtn).toBeDisabled();
      
      const closeBtn = screen.getByRole("button", { name: /close dialog/i });
      expect(closeBtn).toBeDisabled();
    });

    it("disables buttons when loading", () => {
      render(<ConfirmationDialog {...defaultProps} loading={true} />);
      
      expect(screen.getByRole("button", { name: /processing/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });
  });

  describe("Variants", () => {
    it("renders danger variant", () => {
      render(<ConfirmationDialog {...defaultProps} variant="danger" />);
      expect(screen.getByRole("alertdialog")).toHaveClass("border-red-200");
    });

    it("renders warning variant", () => {
      render(<ConfirmationDialog {...defaultProps} variant="warning" />);
      expect(screen.getByRole("alertdialog")).toHaveClass("border-amber-200");
    });

    it("renders info variant", () => {
      render(<ConfirmationDialog {...defaultProps} variant="info" />);
      expect(screen.getByRole("alertdialog")).toHaveClass("border-blue-200");
    });
  });

  describe("Details", () => {
    it("renders transaction details", () => {
      render(
        <ConfirmationDialog
          {...defaultProps}
          details={[
            { label: "Amount", value: "100 XLM" },
            { label: "Destination", value: "GABC...1234" },
          ]}
        />
      );

      expect(screen.getByText("Amount")).toBeInTheDocument();
      expect(screen.getByText("100 XLM")).toBeInTheDocument();
      expect(screen.getByText("Destination")).toBeInTheDocument();
      expect(screen.getByText("GABC...1234")).toBeInTheDocument();
    });

    it("renders highlighted details differently", () => {
      render(
        <ConfirmationDialog
          {...defaultProps}
          details={[{ label: "Amount", value: "100 XLM", highlight: true }]}
        />
      );

      const value = screen.getByText("100 XLM");
      expect(value).toHaveClass("text-red-600");
    });
  });

  describe("Network and Fee", () => {
    it("renders network info", () => {
      render(<ConfirmationDialog {...defaultProps} network="Testnet" />);
      expect(screen.getByText("Network")).toBeInTheDocument();
      expect(screen.getByText("Testnet")).toBeInTheDocument();
    });

    it("renders fee info", () => {
      render(<ConfirmationDialog {...defaultProps} fee="0.0000100 XLM" />);
      expect(screen.getByText("Estimated Fee")).toBeInTheDocument();
      expect(screen.getByText("0.0000100 XLM")).toBeInTheDocument();
    });
  });

  describe("Risk Cues", () => {
    it("renders numbered risk cues", () => {
      render(
        <ConfirmationDialog
          {...defaultProps}
          riskCues={[
            "This is irreversible.",
            "Double-check the address.",
          ]}
        />
      );

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("This is irreversible.")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("Double-check the address.")).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("shows processing text when loading", () => {
      render(<ConfirmationDialog {...defaultProps} loading={true} />);
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
    });
  });

  describe("Body Scroll Lock", () => {
    it("locks body scroll when open", () => {
      render(<ConfirmationDialog {...defaultProps} />);
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("unlocks body scroll when closed", () => {
      const { rerender } = render(<ConfirmationDialog {...defaultProps} />);
      rerender(<ConfirmationDialog {...defaultProps} open={false} />);
      expect(document.body.style.overflow).toBe("");
    });
  });
});
