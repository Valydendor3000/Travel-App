function TripsScreen() {
  const GROUP_ID = "g1";

  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState([]); // trips list
  const [selected, setSelected] = React.useState(null); // trip id to show details
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/api/trips?groupId=${encodeURIComponent(GROUP_ID)}`);
      const j = await r.json();
      setRows(Array.isArray(j) ? j : []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  if (selected) {
    return <TripDetailsView tripId={selected} onBack={() => setSelected(null)} />;
  }

  const d = (s)=> s ? new Date(s*1000).toLocaleDateString() : "TBD";

  return (
    <ScrollView style={{flex:1, padding:16}}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}
    >
      <H1>Trips</H1>
      <P style={{marginBottom:12}}>Your upcoming group trips</P>

      {loading ? <ActivityIndicator style={{marginTop:24}}/> :
        rows.length === 0 ? <EmptyState text="No trips yet."/> :
        rows.map(t => (
          <Pressable key={t.id} onPress={()=>setSelected(t.id)}>
            <Card style={{marginBottom:12}}>
              <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center"}}>
                <Text style={{fontSize:16, fontWeight:"800", color:theme.text}}>{t.title}</Text>
                <Tag>{t.is_public ? "Public" : "Private"}</Tag>
              </View>
              <P style={{marginTop:6}}>{d(t.start_date)} — {d(t.end_date)}</P>
              {t.has_cruise || t.has_flights || t.has_hotel || t.has_all_inclusive ? (
                <P style={{marginTop:6}}>
                  {t.has_cruise ? "Cruise · " : ""}{t.has_flights ? "Flights · " : ""}{t.has_hotel ? "Hotel · " : ""}{t.has_all_inclusive ? "All-inclusive" : ""}
                </P>
              ) : null}
            </Card>
          </Pressable>
        ))
      }
    </ScrollView>
  );
}
