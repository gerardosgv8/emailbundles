import { createContext, useContext, useReducer } from 'react'

const TemplateBuilderContext = createContext()

const initialState = {
  templates: [],
  currentTemplate: null,
  emails: [],
  currentEmail: null,
  isLoading: false,
  error: null,
}

function templateBuilderReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }
    case 'SET_TEMPLATES':
      return { ...state, templates: action.payload, isLoading: false }
    case 'SET_CURRENT_TEMPLATE':
      return { ...state, currentTemplate: action.payload }
    case 'SET_EMAILS':
      return { ...state, emails: action.payload }
    case 'SET_CURRENT_EMAIL':
      return { ...state, currentEmail: action.payload }
    case 'ADD_TEMPLATE':
      return { ...state, templates: [...state.templates, action.payload] }
    case 'UPDATE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.map(t => 
          t.id === action.payload.id ? action.payload : t
        )
      }
    case 'DELETE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.filter(t => t.id !== action.payload)
      }
    case 'ADD_EMAIL':
      return { ...state, emails: [...state.emails, action.payload] }
    case 'UPDATE_EMAIL':
      return {
        ...state,
        emails: state.emails.map(e => 
          e.id === action.payload.id ? action.payload : e
        )
      }
    case 'DELETE_EMAIL':
      return {
        ...state,
        emails: state.emails.filter(e => e.id !== action.payload)
      }
    default:
      return state
  }
}

export function TemplateBuilderProvider({ children }) {
  const [state, dispatch] = useReducer(templateBuilderReducer, initialState)

  const value = {
    ...state,
    dispatch,
    // Helper functions
    setLoading: (loading) => dispatch({ type: 'SET_LOADING', payload: loading }),
    setError: (error) => dispatch({ type: 'SET_ERROR', payload: error }),
    setTemplates: (templates) => dispatch({ type: 'SET_TEMPLATES', payload: templates }),
    setCurrentTemplate: (template) => dispatch({ type: 'SET_CURRENT_TEMPLATE', payload: template }),
    setEmails: (emails) => dispatch({ type: 'SET_EMAILS', payload: emails }),
    setCurrentEmail: (email) => dispatch({ type: 'SET_CURRENT_EMAIL', payload: email }),
    addTemplate: (template) => dispatch({ type: 'ADD_TEMPLATE', payload: template }),
    updateTemplate: (template) => dispatch({ type: 'UPDATE_TEMPLATE', payload: template }),
    deleteTemplate: (id) => dispatch({ type: 'DELETE_TEMPLATE', payload: id }),
    addEmail: (email) => dispatch({ type: 'ADD_EMAIL', payload: email }),
    updateEmail: (email) => dispatch({ type: 'UPDATE_EMAIL', payload: email }),
    deleteEmail: (id) => dispatch({ type: 'DELETE_EMAIL', payload: id }),
  }

  return (
    <TemplateBuilderContext.Provider value={value}>
      {children}
    </TemplateBuilderContext.Provider>
  )
}

export function useTemplateBuilder() {
  const context = useContext(TemplateBuilderContext)
  if (!context) {
    throw new Error('useTemplateBuilder must be used within a TemplateBuilderProvider')
  }
  return context
}

