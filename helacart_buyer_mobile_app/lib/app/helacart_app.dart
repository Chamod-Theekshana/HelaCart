import 'hc.dart';
import 'router.dart';

class HelaCartApp extends ConsumerWidget {
  const HelaCartApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => MaterialApp.router(
    title: 'HelaCart',
    debugShowCheckedModeBanner: false,
    theme: helacartTheme(),
    routerConfig: ref.watch(routerProvider),
  );
}
