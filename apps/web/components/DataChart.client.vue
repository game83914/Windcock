<template>
  <VChart :option="option" :autoresize="autoresize" />
</template>

<script setup lang="ts">
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import { AxisPointerComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';

use([CanvasRenderer, BarChart, LineChart, ScatterChart, AxisPointerComponent, DataZoomComponent, GridComponent, LegendComponent, TooltipComponent]);

withDefaults(defineProps<{
  option: Record<string, unknown>;
  autoresize?: boolean;
}>(), {
  autoresize: true,
});
</script>
