import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type ChartPoint = {
  label: string;
  value: number;
};

type SvgPoint = {
  x: number;
  y: number;
  label: string;
  value: number;
};

@Component({
  selector: 'app-appointments-chart',
  templateUrl: './appointments-chart.html',
  styleUrl: './appointments-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentsChartComponent {
  readonly points = input<ChartPoint[]>([]);

  private readonly width = 640;
  private readonly height = 240;
  private readonly paddingX = 32;
  private readonly paddingTop = 24;
  private readonly paddingBottom = 40;

  readonly maxValue = computed(() => {
    const values = this.points().map(point => point.value);
    const max = Math.max(...values, 0);
    return max === 0 ? 1 : max;
  });

  readonly svgPoints = computed<SvgPoint[]>(() => {
    const data = this.points();
    if (data.length === 0) return [];

    const chartWidth = this.width - this.paddingX * 2;
    const chartHeight = this.height - this.paddingTop - this.paddingBottom;
    const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;

    return data.map((point, index) => {
      const ratio = point.value / this.maxValue();
      const x = this.paddingX + index * stepX;
      const y = this.paddingTop + chartHeight - ratio * chartHeight;

      return {
        x,
        y,
        label: point.label,
        value: point.value,
      };
    });
  });

  readonly polylinePoints = computed(() =>
    this.svgPoints()
      .map(point => `${point.x},${point.y}`)
      .join(' '),
  );

  readonly gridLines = computed(() => {
    const steps = 4;
    const chartHeight = this.height - this.paddingTop - this.paddingBottom;

    return Array.from({ length: steps + 1 }, (_, index) => {
      const ratio = index / steps;
      const y = this.paddingTop + chartHeight * ratio;
      return y;
    });
  });

  readonly yAxisLabels = computed(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, index) => {
      const value = Math.round(this.maxValue() - (this.maxValue() / steps) * index);
      const chartHeight = this.height - this.paddingTop - this.paddingBottom;
      const y = this.paddingTop + chartHeight * (index / steps);

      return { value, y };
    });
  });

  readonly hasData = computed(() => this.points().length > 0);

  chartWidth(): number {
    return this.width;
  }

  chartHeight(): number {
    return this.height;
  }
}
