import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type FlowStep = 'closed' | 'instructions' | 'assignment';
type FlowMode = 'submit' | 'resubmit';

interface AssignmentFlowState {
  step: FlowStep;
  assignment: any | null;
  submission: any | null;
  mode: FlowMode;
  onSuccess?: () => void;
}

interface AssignmentFlowContextType {
  openAssignmentFlow: (params: { assignment: any; submission?: any; mode: FlowMode; onSuccess?: () => void }) => void;
  continueToAssignment: () => void;
  reopenInstructions: () => void;
  closeFlow: () => void;
  state: AssignmentFlowState;
}

const AssignmentFlowContext = createContext<AssignmentFlowContextType | undefined>(undefined);

export function AssignmentFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AssignmentFlowState>({
    step: 'closed',
    assignment: null,
    submission: null,
    mode: 'submit',
  });

  const openAssignmentFlow = ({ assignment, submission, mode, onSuccess }: { assignment: any; submission?: any; mode: FlowMode; onSuccess?: () => void }) => {
    setState({
      step: 'instructions',
      assignment,
      submission: submission || null,
      mode,
      onSuccess,
    });
  };

  const continueToAssignment = () => {
    setState((prev) => ({ ...prev, step: 'assignment' }));
  };

  const reopenInstructions = () => {
    setState((prev) => ({ ...prev, step: 'instructions' }));
  };

  const closeFlow = () => {
    setState((prev) => ({ ...prev, step: 'closed' }));
    // Wait for animation before clearing assignment (optional)
    setTimeout(() => {
      setState({ step: 'closed', assignment: null, submission: null, mode: 'submit' });
    }, 300);
  };

  return (
    <AssignmentFlowContext.Provider
      value={{ openAssignmentFlow, continueToAssignment, reopenInstructions, closeFlow, state }}
    >
      {children}
      {/* Modals will be rendered here */}
    </AssignmentFlowContext.Provider>
  );
}

export function useAssignmentFlow() {
  const context = useContext(AssignmentFlowContext);
  if (context === undefined) {
    throw new Error('useAssignmentFlow must be used within an AssignmentFlowProvider');
  }
  return context;
}
