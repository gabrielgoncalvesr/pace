package kpi

type Progress struct {
	KPIID             string
	CurrentValue      float64
	TargetValue       float64
	Percentage        float64
	VisualPercentage  float64
	ProgressStatus    string
	IsCompleted       bool
	HasExceededTarget bool
}
